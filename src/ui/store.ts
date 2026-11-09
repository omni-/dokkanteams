import { computed, reactive, ref, shallowRef, watch } from 'vue';
import {
  addToBattlefield,
  clearBattlefieldTeam,
  emptyBattlefield,
  removeFromBattlefield,
  restoreBattlefield,
  usedUnitIds,
} from '../core/battlefield.ts';
import type { AddResult, Battlefield } from '../core/battlefield.ts';
import { emptyFilters } from '../core/browse.ts';
import type { BrowseFilters, SortDirection, SortKey } from '../core/browse.ts';
import type { Dataset, Unit } from '../core/types.ts';
import { loadSaved, save } from './storage.ts';

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

  watch(favorites, value => save('favorites', [...value]), { deep: true });
  watch(teamIds, value => save('team', value), { deep: true });
  watch(battlefield, value => save('battlefield', value), { deep: true });
}

watch(page, value => save('page', value));
watch(settings, value => save('settings', value), { deep: true });
watch(sort, value => save('sort', value), { deep: true });

export function selectUnit(unit: Unit): void {
  selectedId.value = unit.id;
}

export function toggleFavorite(unit: Unit): void {
  const next = new Set(favorites.value);
  if (!next.delete(unit.id)) next.add(unit.id);
  favorites.value = next;
}

export function isInTeam(unit: Unit): boolean {
  return teamIds.value.includes(unit.id);
}

export function addToTeam(unit: Unit): void {
  if (!isInTeam(unit)) teamIds.value = [...teamIds.value, unit.id];
}

export function removeFromTeam(unit: Unit): void {
  teamIds.value = teamIds.value.filter(id => id !== unit.id);
}

export function clearTeam(): void {
  teamIds.value = [];
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

/** Narrows the browser to one category, e.g. from a category name in a leader skill. */
export function filterByCategory(category: string): void {
  filters.categories = [category];
  filters.categoryMode = 'any';
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
