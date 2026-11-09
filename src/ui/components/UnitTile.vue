<script setup lang="ts">
import type { Unit } from '../../core/types.ts';

defineProps<{
  unit: Unit;
  label?: string | null;
  favorite?: boolean;
  checked?: boolean;
  selected?: boolean;
  small?: boolean;
  tooltip?: string;
}>();
defineEmits<{ pick: [unit: Unit] }>();

const base = import.meta.env.BASE_URL;
</script>

<template>
  <button
    type="button"
    class="tile"
    :class="[`type-${unit.type}`, { small, selected, checked }]"
    :title="tooltip ?? `${unit.name} — ${unit.title}`"
    @click="$emit('pick', unit)"
  >
    <span class="portrait" :class="unit.class === 'Super' ? 'super' : 'extreme'">
      <img :src="base + unit.image" :alt="unit.name" loading="lazy" decoding="async" width="250" height="250" />
      <span class="rarity" :class="unit.rarity">{{ unit.rarity }}</span>
      <span class="type">{{ unit.class === 'Super' ? 'S' : 'E' }}·{{ unit.type }}</span>
      <span v-if="unit.formOf != null" class="form" title="Transformed form">↻</span>
      <span v-if="favorite" class="star" title="Favorite">★</span>
      <span v-if="checked" class="check" title="Added">✓</span>
    </span>
    <span v-if="label" class="label">{{ label }}</span>
  </button>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  min-width: 0;
}
.tile:hover { background: none; }
.tile:hover .portrait { filter: brightness(1.12); }

.portrait {
  position: relative;
  display: block;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--type);
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--type) 55%, white 10%), color-mix(in srgb, var(--type) 35%, black) 75%);
}
.portrait.super { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--super) 70%, transparent); }
.portrait.extreme { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--extreme) 70%, transparent); }
.selected .portrait { outline: 3px solid var(--accent); outline-offset: 1px; }
.checked .portrait img { opacity: 0.55; }

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.rarity, .type, .form, .star, .check {
  position: absolute;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  padding: 2px 3px;
  border-radius: 4px;
  color: #fff;
  text-shadow: 0 1px 1px rgb(0 0 0 / 0.6);
}
.rarity { left: 2px; bottom: 2px; background: rgb(0 0 0 / 0.55); }
.rarity.LR { background: linear-gradient(90deg, #e74c3c, #f1c40f, #2ecc71, #3498db, #9b59b6); }
.rarity.UR { background: #b8860b; }
.type { right: 2px; top: 2px; background: color-mix(in srgb, var(--type) 85%, black); }
.form { left: 2px; top: 2px; background: rgb(0 0 0 / 0.6); font-size: 11px; }
.star { right: 2px; bottom: 2px; background: none; color: var(--accent); font-size: 13px; padding: 0; }
.check {
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 26px;
  background: rgb(0 0 0 / 0.25);
  color: var(--good);
}

.label {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--panel-2);
  border-radius: 4px;
  padding: 1px 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.small .rarity, .small .type { display: none; }
.small .label { font-size: 0.7rem; }
</style>
