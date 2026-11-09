<script setup lang="ts">
import { computed } from 'vue';
import { drag } from '../drag.ts';
import { dropPreview } from '../store.ts';
import UnitCard from './UnitCard.vue';

const preview = computed(() => (drag.unit && drag.origin ? dropPreview(drag.unit, drag.origin, drag.target) : 'none'));
</script>

<template>
  <div v-if="drag.unit" class="ghost" :style="{ transform: `translate(${drag.x}px, ${drag.y}px)` }" aria-hidden="true">
    <UnitCard :unit="drag.unit" />
    <span v-if="preview !== 'none'" class="badge" :class="preview">{{ preview === 'remove' ? '−' : preview === 'add' ? '+' : '⇄' }}</span>
  </div>
</template>

<style scoped>
.ghost {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  width: 76px;
  margin: -46px 0 0 -38px;
  pointer-events: none;
  filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.5));
  will-change: transform;
}
.badge {
  position: absolute;
  right: -2px;
  top: -2px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 0 0 2px var(--bg);
}
.add { background: var(--good); }
.move { background: var(--accent); color: var(--accent-text); }
.remove { background: var(--danger); }
</style>
