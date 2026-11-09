import type { Rarity, Unit, UnitClass, UnitType } from './types.ts';

export type SortKey = 'leader' | 'release' | 'cost' | 'hp' | 'atk' | 'def';
export type SortDirection = 'desc' | 'asc';

export const SORT_KEYS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'leader', label: 'Leader' },
  { key: 'release', label: 'Release' },
  { key: 'cost', label: 'Cost' },
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
];

export interface BrowseFilters {
  name: string;
  categories: string[];
  /** 'all' needs every picked category; 'any' needs at least one. */
  categoryMode: 'any' | 'all';
  classes: UnitClass[];
  rarities: Rarity[];
  types: UnitType[];
  favoritesOnly: boolean;
  showForms: boolean;
}

export function emptyFilters(): BrowseFilters {
  return {
    name: '',
    categories: [],
    categoryMode: 'any',
    classes: [],
    rarities: [],
    types: [],
    favoritesOnly: false,
    showForms: false,
  };
}

export function filterUnits(
  units: readonly Unit[],
  filters: BrowseFilters,
  favorites: ReadonlySet<number>,
  hidden: ReadonlySet<number> = new Set(),
): Unit[] {
  const words = filters.name.toLowerCase().split(/\s+/).filter(Boolean);

  return units.filter(unit => {
    if (hidden.has(unit.id)) return false;
    if (!filters.showForms && unit.formOf != null) return false;
    if (filters.favoritesOnly && !favorites.has(unit.id)) return false;
    if (filters.classes.length && !filters.classes.includes(unit.class)) return false;
    if (filters.rarities.length && !filters.rarities.includes(unit.rarity)) return false;
    if (filters.types.length && !filters.types.includes(unit.type)) return false;
    if (filters.categories.length) {
      const has = (category: string) => unit.categories.includes(category);
      const matches = filters.categoryMode === 'all' ? filters.categories.every(has) : filters.categories.some(has);
      if (!matches) return false;
    }
    if (words.length) {
      const haystack = `${unit.name} ${unit.title}`.toLowerCase();
      if (!words.every(word => haystack.includes(word))) return false;
    }
    return true;
  });
}

/** Sorts a copy. Units with no value for the key (no release date, no cost) always go last. */
export function sortUnits(units: readonly Unit[], key: SortKey, direction: SortDirection): Unit[] {
  const sign = direction === 'desc' ? -1 : 1;

  return [...units].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left == null || right == null) {
      if (left != null) return -1;
      if (right != null) return 1;
    } else if (left !== right) {
      return (left < right ? -1 : 1) * sign;
    }
    if (key === 'leader' && a.leaderReach !== b.leaderReach) return (a.leaderReach - b.leaderReach) * sign;
    return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || b.id - a.id;
  });
}

export function sortValue(unit: Unit, key: SortKey): number | string | null {
  switch (key) {
    case 'leader':
      return unit.maxBoost;
    case 'release':
      return unit.releaseDate;
    case 'cost':
      return unit.cost;
    case 'hp':
      return unit.hp;
    case 'atk':
      return unit.atk;
    case 'def':
      return unit.def;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The short value shown under a unit's portrait for the current sort. */
export function sortLabel(unit: Unit, key: SortKey): string {
  const value = sortValue(unit, key);
  if (value == null) return '—';
  if (key === 'leader') return `${value}%`;
  if (key === 'release') return formatMonth(String(value));
  return Number(value).toLocaleString('en-US');
}

/** "2025-11-13" → "Nov 2025". */
export function formatMonth(date: string): string {
  const [year, month] = date.split('-');
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : date;
}
