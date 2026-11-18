<script setup lang="ts">
defineProps<{ leader: boolean; friend: boolean }>();
</script>

<template>
  <span class="boosts" aria-hidden="true"><span :class="{ on: leader }">L</span><span :class="{ on: friend }">F</span></span>
</template>

<style scoped>
.boosts { display: flex; justify-content: center; gap: 2px; }
.boosts span {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--panel-3);
  color: var(--muted);
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1.35;
}
.boosts .on { background: var(--good); color: #fff; }
</style>
