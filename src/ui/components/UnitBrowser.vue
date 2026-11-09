<script setup lang="ts">
import { computed, ref } from 'vue';
import { SORT_KEYS, emptyFilters, filterUnits, sortLabel, sortUnits } from '../../core/browse.ts';
import { RARITIES, UNIT_CLASSES, UNIT_TYPES } from '../../core/types.ts';
import type { Unit } from '../../core/types.ts';
import { art } from '../art.ts';
import type { DragOrigin } from '../drag.ts';
import {
  FAILURE_MESSAGES,
  activeBattlefieldTeam,
  addToActiveBattlefieldTeam,
  addToTeam,
  favorites,
  filters,
  isInTeam,
  removeFromTeam,
  selectUnit,
  selectedId,
  settings,
  showToast,
  sort,
  units,
  unitsById,
  usedInBattlefield,
} from '../store.ts';
import CategoryPicker from './CategoryPicker.vue';
import UnitTile from './UnitTile.vue';

const props = defineProps<{ mode: 'team' | 'battlefield' }>();
const emit = defineEmits<{ picked: [unit: Unit] }>();

const LIST_ORIGIN: DragOrigin = { kind: 'list' };
const showFilters = ref(false);

const visible = computed(() => {
  const hidden = props.mode === 'battlefield' ? usedInBattlefield.value : undefined;
  const activeFilters = props.mode === 'battlefield' ? { ...filters, showForms: false } : filters;
  return sortUnits(filterUnits(units.value, activeFilters, favorites.value, hidden), sort.key, sort.direction);
});

const activeFilterCount = computed(() =>
  [filters.name.trim(), filters.favoritesOnly, filters.showForms].filter(Boolean).length
  + filters.categories.length + filters.classes.length + filters.rarities.length + filters.types.length,
);

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

function resetFilters() {
  Object.assign(filters, emptyFilters());
}

function setSort(key: typeof sort.key) {
  if (sort.key === key) sort.direction = sort.direction === 'desc' ? 'asc' : 'desc';
  else Object.assign(sort, { key, direction: 'desc' });
}

function pick(unit: Unit) {
  if (props.mode === 'battlefield') {
    const result = addToActiveBattlefieldTeam(unit);
    if (!result.ok) showToast(FAILURE_MESSAGES[result.reason]);
    return;
  }
  if (settings.quickAdd) {
    if (isInTeam(unit)) removeFromTeam(unit);
    else addToTeam(unit);
    return;
  }
  selectUnit(unit);
  emit('picked', unit);
}

function tileLabel(unit: Unit) {
  return settings.showLabel ? sortLabel(unit, sort.key) : null;
}
</script>

<template>
  <section class="browser panel">
    <div class="controls">
      <div class="row nowrap">
        <input v-model="filters.name" type="search" placeholder="Search name or title" aria-label="Search units" />
        <button type="button" class="filters-toggle" :aria-expanded="showFilters" @click="showFilters = !showFilters">
          Filters<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span>
        </button>
      </div>

      <div class="filters" :class="{ open: showFilters }">
        <CategoryPicker />
        <div class="row">
          <button
            v-for="rarity in RARITIES"
            :key="rarity"
            type="button"
            class="rarity"
            :aria-label="rarity"
            :title="rarity"
            :aria-pressed="filters.rarities.includes(rarity)"
            @click="filters.rarities = toggleIn(filters.rarities, rarity)"
          ><img :src="art.rarity[rarity]" alt="" /></button>
          <span class="divider" />
          <button
            v-for="unitClass in UNIT_CLASSES"
            :key="unitClass"
            type="button"
            :aria-pressed="filters.classes.includes(unitClass)"
            @click="filters.classes = toggleIn(filters.classes, unitClass)"
          >{{ unitClass }}</button>
        </div>
        <div class="row">
          <button
            v-for="type in UNIT_TYPES"
            :key="type"
            type="button"
            class="type-button"
            :class="`type-${type}`"
            :aria-pressed="filters.types.includes(type)"
            @click="filters.types = toggleIn(filters.types, type)"
          >{{ type }}</button>
        </div>
        <div class="row">
          <button type="button" :aria-pressed="filters.favoritesOnly" @click="filters.favoritesOnly = !filters.favoritesOnly">★ Favorites</button>
          <button
            v-if="mode === 'team'"
            type="button"
            :aria-pressed="filters.showForms"
            title="Show transformed forms as their own tiles"
            @click="filters.showForms = !filters.showForms"
          >↻ Forms</button>
          <button type="button" class="link small" :disabled="activeFilterCount === 0" @click="resetFilters">Reset filters</button>
        </div>
      </div>

      <div class="row sort-row">
        <span class="muted small">Sort</span>
        <button
          v-for="option in SORT_KEYS"
          :key="option.key"
          type="button"
          class="sort"
          :class="{ active: sort.key === option.key }"
          :title="sort.key === option.key ? 'Click again to flip the order' : `Sort by ${option.label}`"
          @click="setSort(option.key)"
        >
          {{ option.label }}<span v-if="sort.key === option.key" aria-hidden="true">{{ sort.direction === 'desc' ? ' ↓' : ' ↑' }}</span>
        </button>
      </div>

      <div class="row spread small">
        <span class="muted">
          {{ visible.length }} units<template v-if="mode === 'battlefield'"> · adding to Team {{ activeBattlefieldTeam + 1 }}</template>
        </span>
        <div class="row">
          <label class="toggle"><input v-model="settings.showLabel" type="checkbox" /> Values</label>
          <label v-if="mode === 'team'" class="toggle" title="Tapping a unit adds it to the team instead of opening its details">
            <input v-model="settings.quickAdd" type="checkbox" /> Quick add
          </label>
        </div>
      </div>
    </div>

    <div v-if="visible.length" class="tile-grid grid" data-drag-scroll>
      <UnitTile
        v-for="unit in visible"
        :key="unit.id"
        :unit="unit"
        :label="tileLabel(unit)"
        :favorite="favorites.has(unit.id)"
        :checked="mode === 'team' && isInTeam(unit)"
        :selected="mode === 'team' && !settings.quickAdd && selectedId === unit.id"
        :origin="LIST_ORIGIN"
        @pick="pick"
      />
    </div>
    <p v-else-if="unitsById.size" class="empty">No units match these filters.</p>
  </section>
</template>

<style scoped>
.browser {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.controls {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--border);
}
.nowrap { flex-wrap: nowrap; }
.filters { display: flex; flex-direction: column; gap: 8px; }
.filters-toggle { display: none; white-space: nowrap; }
.divider { width: 1px; align-self: stretch; margin: 2px 2px; background: var(--border); }
.rarity { padding: 1px 6px; line-height: 0; }
.rarity img { width: 26px; height: 26px; }
.type-button { color: var(--type); font-weight: 600; }
.type-button[aria-pressed='true'] { background: var(--type); border-color: var(--type); color: #fff; }
.sort-row { gap: 4px; }
.sort { padding: 3px 8px; }
.toggle { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.grid {
  --tile: 68px;
  flex: 1;
  min-height: 0;
  align-content: start;
  padding: 10px;
  overflow-y: auto;
}

@media (max-width: 899px) {
  .filters-toggle { display: inline-block; }
  .filters { display: none; }
  .filters.open { display: flex; }
}
</style>
