import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { FRIEND_ID, bestRotations, fitLayout, moveInLayout, restoreRotationLayout, rotationMembers, rotationPlan } from '../core/analysis.ts';
import type { RotationLayout, RotationPlan, RotationSpot } from '../core/analysis.ts';
import {
  addToBattlefield,
  clearBattlefieldTeam,
  emptyBattlefield,
  locateUnit,
  placeOnBattlefield,
  removeFromBattlefield,
  restoreBattlefield,
  usedUnitIds,
} from '../core/battlefield.ts';
import type { AddResult, Battlefield } from '../core/battlefield.ts';
import { emptyFilters } from '../core/browse.ts';
import type { BrowseFilters, Lead, SortDirection, SortKey } from '../core/browse.ts';
import { placeInTeam } from '../core/team.ts';
import type { Dataset, Unit } from '../core/types.ts';
import { onDrop } from './drag.ts';
import type { DragOrigin, DropTarget } from './drag.ts';
import { loadSaved, save } from './storage.ts';

type FailureReason = Exclude<AddResult, { ok: true }>['reason'];

export const FAILURE_MESSAGES: Record<FailureReason, string> = {
  used: 'That card is already in another Battlefield team.',
  full: 'This team is full.',
  form: "Transformed forms can't be fielded on their own.",
  'no-team': 'Pick a team first.',
};

export type Page = 'team' | 'battlefield';

export const dataset = shallowRef<Dataset | null>(null);
export const loadError = ref<string | null>(null);

export const units = computed(() => dataset.value?.units ?? []);
export const linkSkills = computed(() => dataset.value?.links ?? {});
export const unitsById = computed(() => new Map(units.value.map(unit => [unit.id, unit])));
export const fieldableUnits = computed(() => units.value.filter(unit => unit.formOf == null));
export const allCategories = computed(() =>
  [...new Set(units.value.flatMap(unit => unit.categories))].sort((a, b) => a.localeCompare(b)),
);

export const page = ref<Page>(loadSaved<Page>('page') === 'battlefield' ? 'battlefield' : 'team');
export const selectedId = ref<number | null>(null);
export const selectedUnit = computed(() => (selectedId.value == null ? null : unitsById.value.get(selectedId.value) ?? null));
/** On wide screens the details cover the unit list while this is set. */
export const detailOpen = ref(false);

export const settings = reactive({
  minimumLinks: 2,
  showLabel: true,
  quickAdd: false,
  battlefieldQuickAdd: true,
  showBoosts: true,
  maxBoostOnly: false,
  useEza: true,
  asymmetricLead: false,
  ...loadSaved<Record<string, unknown>>('settings'),
});

export const filters = reactive<BrowseFilters>(emptyFilters());
export const sort = reactive<{ key: SortKey; direction: SortDirection }>({
  key: 'leader',
  direction: 'desc',
  ...loadSaved<{ key: SortKey; direction: SortDirection }>('sort'),
});

export const favorites = ref(new Set<number>());
export const teamIds = ref<number[]>([]);
export const team = computed(() =>
  teamIds.value.map(id => unitsById.value.get(id)).filter((unit): unit is Unit => unit != null),
);
/** The first member leads the team. */
export const leader = computed(() => team.value[0] ?? null);
/** Kept while asymmetric lead is off, so turning it back on brings the same friend back. */
export const friendId = ref<number | null>(null);
/** The viewer clicked the friend slot, so the next unit they tap in the list becomes the friend. */
export const pickingFriend = ref(false);
/** The team's two leader skills. Without asymmetric lead the friend is a copy of the leader. */
export const lead = computed<Lead>(() => ({
  leader: leader.value,
  friend: settings.asymmetricLead ? (friendId.value == null ? null : unitsById.value.get(friendId.value) ?? null) : leader.value,
}));
const members = computed(() => rotationMembers(team.value, lead.value.friend));
const memberIds = computed(() => members.value.map(member => member.id));
// Kept in line with the team as members come and go (see fitLayout), so nobody moves unless the viewer moves them.
const rotationLayout = ref<RotationLayout>(fitLayout(null, []));
const fittedLayout = computed(() => fitLayout(rotationLayout.value, memberIds.value));
/** The team's rotations, friend included, as the viewer arranged them. Null while there's nobody to place. */
export const rotations = computed<RotationPlan | null>(() =>
  members.value.length ? rotationPlan(fittedLayout.value, members.value) : null,
);
export const battlefield = ref<Battlefield>(emptyBattlefield());
export const activeBattlefieldTeam = ref(0);
export const usedInBattlefield = computed(() => usedUnitIds(battlefield.value));
/** The leader and friend of the selected Battlefield team. */
export const activeBattlefieldLeaders = computed(() => {
  const team = battlefield.value[activeBattlefieldTeam.value];
  const find = (id: number | null | undefined) => (id == null ? null : unitsById.value.get(id) ?? null);
  return { leader: find(team?.leader1), friend: find(team?.leader2) };
});

export async function loadData(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/units.json`);
    if (!response.ok) throw new Error(`Character data request failed (${response.status}).`);
    const data = (await response.json()) as Dataset;
    dataset.value = data;
    restoreSavedLists();
    selectedId.value ??= teamIds.value[0] ?? data.units[0]?.id ?? null;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
    console.error('Could not load character data', error);
  }
}

// Saved ids are checked against the current data so removed cards don't linger.
function restoreSavedLists() {
  const known = new Set(unitsById.value.keys());
  const keepKnown = (ids: unknown) => (Array.isArray(ids) ? ids.filter((id): id is number => known.has(id)) : []);

  favorites.value = new Set(keepKnown(loadSaved('favorites')));
  teamIds.value = [...new Set(keepKnown(loadSaved('team')))];
  const savedFriend = keepKnown([loadSaved('friend')])[0];
  friendId.value = savedFriend != null && unitsById.value.get(savedFriend)?.formOf == null ? savedFriend : null;
  battlefield.value = restoreBattlefield(loadSaved('battlefield'), known);
  rotationLayout.value = fitLayout(restoreRotationLayout(loadSaved('rotations')), memberIds.value);

  watch(favorites, value => save('favorites', [...value]), { deep: true });
  watch(teamIds, value => save('team', value), { deep: true });
  watch(friendId, value => save('friend', value));
  watch(memberIds, value => (rotationLayout.value = fitLayout(rotationLayout.value, value)));
  watch(rotationLayout, value => save('rotations', value));
  watch(battlefield, value => save('battlefield', value), { deep: true });
}

watch(page, value => save('page', value));
watch(settings, value => save('settings', value), { deep: true });
watch(sort, value => save('sort', value), { deep: true });
watch([page, () => settings.asymmetricLead], () => (pickingFriend.value = false));

export function selectUnit(unit: Unit): void {
  selectedId.value = unit.id;
  detailOpen.value = true;
}

export function closeDetail(): void {
  detailOpen.value = false;
}

export function toggleFavorite(unit: Unit): void {
  const next = new Set(favorites.value);
  if (!next.delete(unit.id)) next.add(unit.id);
  favorites.value = next;
}

export function isInTeam(unit: Unit): boolean {
  return teamIds.value.includes(unit.id);
}

/** Adds a unit to the team, or moves it if it's already there. */
export function addToTeam(unit: Unit, beforeId: number | null = null): void {
  if (unit.formOf != null) {
    showToast(FAILURE_MESSAGES.form);
    return;
  }
  teamIds.value = placeInTeam(teamIds.value, unit.id, beforeId);
}

export function removeFromTeam(unit: Unit): void {
  teamIds.value = teamIds.value.filter(id => id !== unit.id);
}

/** Moves a member, or a unit from outside the team, into the first slot. */
export function makeLeader(unit: Unit): void {
  if (teamIds.value[0] !== unit.id) addToTeam(unit, teamIds.value[0] ?? null);
}

/** Makes `unit` the asymmetric lead's friend. It can be a copy of anyone in the team. */
export function setFriend(unit: Unit): void {
  pickingFriend.value = false;
  if (unit.formOf != null) {
    showToast(FAILURE_MESSAGES.form);
    return;
  }
  friendId.value = unit.id;
}

export function clearFriend(): void {
  friendId.value = null;
}

export function clearTeam(): void {
  teamIds.value = [];
  friendId.value = null;
}

/** Moves a member to a spot in the rotations, swapping with whoever is there. The friend goes by FRIEND_ID. */
export function moveInRotations(memberId: number, spot: RotationSpot): void {
  rotationLayout.value = moveInLayout(fittedLayout.value, memberId, spot);
}

/** Rearranges the rotations so the pairs share as many links as possible. */
export function arrangeBestRotations(): void {
  rotationLayout.value = fitLayout(bestRotations(members.value), memberIds.value);
}

export function addToActiveBattlefieldTeam(unit: Unit): AddResult {
  const result = addToBattlefield(battlefield.value, activeBattlefieldTeam.value, unit);
  if (result.ok) battlefield.value = result.battlefield;
  return result;
}

/** The index of the Battlefield team the unit is in, or null. */
export function battlefieldTeamOf(unit: Unit): number | null {
  return locateUnit(battlefield.value, unit.id)?.team ?? null;
}

export function removeBattlefieldUnit(unitId: number): void {
  battlefield.value = removeFromBattlefield(battlefield.value, unitId);
}

export function clearBattlefieldTeamAt(teamIndex: number): void {
  battlefield.value = clearBattlefieldTeam(battlefield.value, teamIndex);
}

export function clearWholeBattlefield(): void {
  battlefield.value = emptyBattlefield();
}

export type DropPreview = 'add' | 'move' | 'remove' | 'none';

// The dragged tile's id in the rotations, or null for a unit that isn't in them yet.
function rotationIdOf(unit: Unit, origin: DragOrigin): number | null {
  if (origin.kind === 'rotation') return origin.member;
  if (origin.kind === 'friend') return FRIEND_ID;
  return isInTeam(unit) ? unit.id : null;
}

/** What letting go would do, shown on the dragged card. Mirrors dropUnit. */
export function dropPreview(unit: Unit, origin: DragOrigin, target: DropTarget | null): DropPreview {
  if (target?.kind === 'team') {
    if (unit.formOf != null) return 'none';
    return origin.kind === 'team' || isInTeam(unit) ? 'move' : 'add';
  }
  if (target?.kind === 'friend') {
    // Team members stay where they are: the friend can be a copy of any of them.
    return unit.formOf != null || friendId.value === unit.id ? 'none' : 'add';
  }
  if (target?.kind === 'rotation') {
    if (unit.formOf != null) return 'none';
    const id = rotationIdOf(unit, origin);
    if (id == null) return 'add';
    return target.spot && moveInLayout(fittedLayout.value, id, target.spot) !== fittedLayout.value ? 'move' : 'none';
  }
  if (target?.kind === 'battlefield') {
    if (unit.formOf != null) return 'none';
    return origin.kind === 'battlefield' ? 'move' : 'add';
  }
  return origin.kind === 'team' || origin.kind === 'friend' || origin.kind === 'battlefield' ? 'remove' : 'none';
}

export function dropUnit(unit: Unit, origin: DragOrigin, target: DropTarget | null): void {
  if (target?.kind === 'team') {
    addToTeam(unit, target.beforeId);
    return;
  }

  if (target?.kind === 'friend') {
    setFriend(unit);
    return;
  }

  if (target?.kind === 'rotation') {
    // A unit from outside joins the team first, then takes the spot it was dropped on like a member would.
    let id = rotationIdOf(unit, origin);
    if (id == null) {
      addToTeam(unit);
      id = isInTeam(unit) ? unit.id : null;
    }
    if (id != null && target.spot) moveInRotations(id, target.spot);
    return;
  }

  if (target?.kind === 'battlefield') {
    const result = placeOnBattlefield(battlefield.value, target, unit);
    if (!result.ok) {
      showToast(FAILURE_MESSAGES[result.reason]);
      return;
    }
    battlefield.value = result.battlefield;
    activeBattlefieldTeam.value = target.team;
    return;
  }

  // Dropped outside every team: dragging a unit out of one takes it off.
  if (origin.kind === 'team') removeFromTeam(unit);
  else if (origin.kind === 'friend') clearFriend();
  else if (origin.kind === 'battlefield') removeBattlefieldUnit(unit.id);
}

onDrop(dropUnit);

/** Narrows the browser to one category, e.g. from a category name in a leader skill. */
export function filterByCategory(category: string): void {
  filters.categories = [category];
  filters.categoryMode = 'any';
  detailOpen.value = false;
}

/** The text to show for a unit: EZA when the unit has it and the viewer wants it. */
export function skillsFor(unit: Unit) {
  return settings.useEza && unit.eza ? unit.eza : unit.base;
}

export const toast = ref<{ message: string; id: number } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string): void {
  toast.value = { message, id: Date.now() };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2600);
}
