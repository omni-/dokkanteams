import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { bestRotations, layoutOf, planFromLayout, restoreRotationLayout, swapInLayout } from '../core/analysis.ts';
import type { RotationLayout, RotationPlan } from '../core/analysis.ts';
import {
  addToBattlefield,
  clearBattlefieldTeam,
  emptyBattlefield,
  placeOnBattlefield,
  removeFromBattlefield,
  restoreBattlefield,
  usedUnitIds,
} from '../core/battlefield.ts';
import type { AddResult, Battlefield } from '../core/battlefield.ts';
import { emptyFilters } from '../core/browse.ts';
import type { BrowseFilters, SortDirection, SortKey } from '../core/browse.ts';
import { placeInTeam } from '../core/team.ts';
import type { Dataset, Unit } from '../core/types.ts';
import { onDrop } from './drag.ts';
import type { DragOrigin, DropTarget } from './drag.ts';
import { loadSaved, save } from './storage.ts';

type FailureReason = Exclude<AddResult, { ok: true }>['reason'];

export const FAILURE_MESSAGES: Record<FailureReason, string> = {
  used: 'That card is already in another Battlefield team.',
  full: 'This team is full.',
  duplicate: 'A card of that character is already in this team.',
  form: "Transformed forms can't be fielded on their own.",
  'no-team': 'Pick a team first.',
};

export type Page = 'team' | 'battlefield';

export const dataset = shallowRef<Dataset | null>(null);
export const loadError = ref<string | null>(null);

export const units = computed(() => dataset.value?.units ?? []);
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
  maxBoostOnly: false,
  useEza: true,
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
// Rotations the viewer rearranged. They only apply while the team has exactly the same members.
const rotationLayout = ref<RotationLayout | null>(null);
const customRotations = computed(() => (rotationLayout.value ? planFromLayout(rotationLayout.value, team.value) : null));
export const rotationsRearranged = computed(() => customRotations.value != null);
/** The team's rotations: the viewer's own arrangement, or else the best one. */
export const rotations = computed<RotationPlan | null>(() => customRotations.value ?? bestRotations(team.value));
export const battlefield = ref<Battlefield>(emptyBattlefield());
export const activeBattlefieldTeam = ref(0);
export const usedInBattlefield = computed(() => usedUnitIds(battlefield.value));

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
  battlefield.value = restoreBattlefield(loadSaved('battlefield'), known);
  rotationLayout.value = restoreRotationLayout(loadSaved('rotations'));

  watch(favorites, value => save('favorites', [...value]), { deep: true });
  watch(teamIds, value => save('team', value), { deep: true });
  watch(rotationLayout, value => save('rotations', value));
  watch(battlefield, value => save('battlefield', value), { deep: true });
}

watch(page, value => save('page', value));
watch(settings, value => save('settings', value), { deep: true });
watch(sort, value => save('sort', value), { deep: true });

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

export function clearTeam(): void {
  teamIds.value = [];
}

/** Swaps two team members' places in the rotations. */
export function swapInRotations(a: Unit, b: Unit): void {
  if (!rotations.value || a.id === b.id) return;
  rotationLayout.value = swapInLayout(layoutOf(rotations.value), a.id, b.id);
}

export function resetRotations(): void {
  rotationLayout.value = null;
}

export function addToActiveBattlefieldTeam(unit: Unit): AddResult {
  const result = addToBattlefield(battlefield.value, activeBattlefieldTeam.value, unit, unitsById.value);
  if (result.ok) battlefield.value = result.battlefield;
  return result;
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

/** What letting go would do, shown on the dragged card. Mirrors dropUnit. */
export function dropPreview(unit: Unit, origin: DragOrigin, target: DropTarget | null): DropPreview {
  if (target?.kind === 'team') {
    if (unit.formOf != null) return 'none';
    return origin.kind === 'team' || isInTeam(unit) ? 'move' : 'add';
  }
  if (target?.kind === 'rotation') {
    if (unit.formOf != null) return 'none';
    if (!isInTeam(unit)) return 'add';
    return target.unitId != null && target.unitId !== unit.id ? 'move' : 'none';
  }
  if (target?.kind === 'battlefield') {
    if (unit.formOf != null) return 'none';
    return origin.kind === 'battlefield' ? 'move' : 'add';
  }
  return origin.kind === 'team' || origin.kind === 'battlefield' ? 'remove' : 'none';
}

export function dropUnit(unit: Unit, origin: DragOrigin, target: DropTarget | null): void {
  if (target?.kind === 'team') {
    addToTeam(unit, target.beforeId);
    return;
  }

  if (target?.kind === 'rotation') {
    // Units from outside the team join it; members swap places with the one they're dropped on.
    const other = target.unitId == null ? undefined : unitsById.value.get(target.unitId);
    if (!isInTeam(unit)) addToTeam(unit);
    else if (other) swapInRotations(unit, other);
    return;
  }

  if (target?.kind === 'battlefield') {
    const result = placeOnBattlefield(battlefield.value, target, unit, unitsById.value);
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
