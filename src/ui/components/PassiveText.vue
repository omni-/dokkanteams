<script setup lang="ts">
import { computed } from 'vue';
import { parsePassive, passiveParts } from '../../core/passive.ts';
import type { PassiveIcon } from '../../core/passive.ts';
import { art } from '../art.ts';
import CategoryText from './CategoryText.vue';

const props = defineProps<{ text: string }>();

const groups = computed(() =>
  parsePassive(props.text).map(group => ({ ...group, effects: group.effects.map(passiveParts) })),
);

const iconLabels: Record<PassiveIcon, string> = {
  once: 'Activates once',
  forever: 'Lasts for the rest of battle',
};
</script>

<template>
  <p v-if="groups.length === 0">—</p>
  <div v-else class="passive">
    <section v-for="(group, index) in groups" :key="index">
      <h4 v-if="group.heading"><CategoryText :text="group.heading" /></h4>
      <ul>
        <li v-for="(effect, effectIndex) in group.effects" :key="effectIndex">
          <template v-for="(part, partIndex) in effect" :key="partIndex">
            <img
              v-if="part.icon"
              class="icon"
              :src="art.passive[part.icon]"
              :alt="iconLabels[part.icon]"
              :title="iconLabels[part.icon]"
              width="52"
              height="19"
            />
            <CategoryText v-else :text="part.text" />
          </template>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.passive { display: flex; flex-direction: column; gap: 8px; }
h4 { margin: 0 0 2px; font-size: 0.88rem; font-weight: 650; }
ul { margin: 0; padding-left: 18px; }
li + li { margin-top: 2px; }
li::marker { color: var(--muted); }
.icon {
  width: auto;
  height: 15px;
  margin-right: 3px;
  vertical-align: -2px;
}
</style>
