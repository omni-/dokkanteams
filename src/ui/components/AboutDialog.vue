<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatMonth } from '../../core/browse.ts';
import { dataset, units } from '../store.ts';

const dialog = ref<HTMLDialogElement | null>(null);

const newestRelease = computed(() => units.value.reduce<string | null>(
  (newest, unit) => (unit.releaseDate && (!newest || unit.releaseDate > newest) ? unit.releaseDate : newest),
  null,
));
const parsedLeaders = computed(() => units.value.filter(unit => unit.leader).length);
const updated = computed(() => (dataset.value ? new Date(dataset.value.generatedAt).toLocaleDateString() : null));

defineExpose({ open: () => dialog.value?.showModal() });
</script>

<template>
  <dialog ref="dialog" class="about panel" @click.self="dialog?.close()">
    <div class="content">
      <header class="row spread">
        <h2>About</h2>
        <button type="button" aria-label="Close" @click="dialog?.close()">✕</button>
      </header>
      <p>
        Team building tools for Dragon Ball Z Dokkan Battle: shared links, leader skill coverage, possible teams and
        Battlefield planning. Part of <a href="https://dokkandle.net/daily">Dokkandle</a>.
      </p>
      <h3>How leader boosts are counted</h3>
      <p>
        Boosts are the average of a leader skill's HP, ATK and DEF bonuses, plus any “plus an additional…” bonus the
        unit qualifies for. Category, Type, Class and all-Type leaders count. Leader skills with conditions (HP
        thresholds, team requirements, per-Ki-Sphere boosts) are left out. EZA leader skills are used when a unit has one.
      </p>
      <h3>Data</h3>
      <p v-if="dataset">
        {{ units.length }} cards ({{ parsedLeaders }} with a counted leader skill), newest released
        {{ newestRelease ? formatMonth(newestRelease) : 'unknown' }}. Updated {{ updated }}.
        Character data comes from <a href="https://dokkanstats.com">DokkanStats</a>.
      </p>
      <p class="muted small">
        Your favorites, team and Battlefield plan are saved in this browser only.
        Fan-made and not affiliated with Bandai Namco, Toei Animation or Akatsuki. Dragon Ball and all character art
        belong to their owners.
      </p>
    </div>
  </dialog>
</template>

<style scoped>
.about {
  max-width: min(560px, calc(100vw - 32px));
  padding: 0;
  color: var(--text);
}
.about::backdrop { background: rgb(0 0 0 / 0.55); }
.content { padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
h2 { margin: 0; }
h3 { margin: 10px 0 0; font-size: 0.95rem; }
p { margin: 4px 0; }
a { color: var(--accent); }
</style>
