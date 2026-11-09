<script setup lang="ts">
import { computed, ref } from 'vue';
import { allCategories, filters } from '../store.ts';

const query = ref('');
const open = ref(false);

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return allCategories.value.filter(category => !needle || category.toLowerCase().includes(needle));
});

function toggle(category: string) {
  filters.categories = filters.categories.includes(category)
    ? filters.categories.filter(existing => existing !== category)
    : [...filters.categories, category];
}

function closeSoon() {
  // Let a click on an option land before the list closes.
  setTimeout(() => (open.value = false), 150);
}
</script>

<template>
  <div class="picker">
    <div class="row">
      <input
        v-model="query"
        type="search"
        placeholder="Categories…"
        aria-label="Filter by category"
        @focus="open = true"
        @blur="closeSoon"
      />
      <button
        v-if="filters.categories.length > 1"
        type="button"
        class="mode"
        :title="filters.categoryMode === 'all' ? 'Units must be in every picked category' : 'Units can be in any picked category'"
        @click="filters.categoryMode = filters.categoryMode === 'all' ? 'any' : 'all'"
      >
        {{ filters.categoryMode === 'all' ? 'All of' : 'Any of' }}
      </button>
    </div>
    <ul v-if="open" class="options panel" role="listbox" aria-multiselectable="true">
      <li v-for="category in matches" :key="category">
        <button
          type="button"
          role="option"
          :aria-selected="filters.categories.includes(category)"
          :class="{ picked: filters.categories.includes(category) }"
          @mousedown.prevent="toggle(category)"
        >
          {{ category }}
        </button>
      </li>
      <li v-if="matches.length === 0" class="muted small none">No matching category</li>
    </ul>
    <div v-if="filters.categories.length" class="row picked-list">
      <button v-for="category in filters.categories" :key="category" type="button" class="chip" @click="toggle(category)">
        {{ category }} <span aria-hidden="true">×</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.picker { position: relative; }
.row { flex-wrap: nowrap; }
.mode { white-space: nowrap; }
.options {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  max-height: 280px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
}
.options button {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 5px 8px;
}
.options button:hover { background: var(--panel-3); }
.options button.picked { color: var(--accent); font-weight: 600; }
.options button.picked::before { content: '✓ '; }
.none { padding: 6px 8px; }
.picked-list { margin-top: 6px; flex-wrap: wrap; }
</style>
