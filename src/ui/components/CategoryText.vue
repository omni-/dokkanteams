<script setup lang="ts">
import { computed } from 'vue';
import { allCategories, filterByCategory } from '../store.ts';

const props = defineProps<{ text: string }>();

interface Part {
  text: string;
  category: string | null;
}

// Quoted category names become buttons that filter the unit list.
const parts = computed<Part[]>(() => {
  const known = new Set(allCategories.value);
  return props.text.split(/("[^"]+")/).map(text => {
    const name = text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1) : null;
    return { text, category: name && known.has(name) ? name : null };
  });
});

function pick(part: Part) {
  if (part.category) filterByCategory(part.category);
}
</script>

<template>
  <span class="category-text">
    <template v-for="(part, index) in parts" :key="index">
      <button
        v-if="part.category"
        type="button"
        class="link"
        :title="`Show ${part.category} units`"
        @click="pick(part)"
      >{{ part.text }}</button>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<style scoped>
.category-text { white-space: pre-line; }
.link { font-weight: 600; text-decoration: none; }
.link:hover { text-decoration: underline; }
</style>
