<script setup lang="ts">
import { titledName } from '../../core/browse.ts';
import type { Unit } from '../../core/types.ts';
import { drag, startDrag } from '../drag.ts';
import type { DragOrigin } from '../drag.ts';
import UnitCard from './UnitCard.vue';

const props = defineProps<{
  unit: Unit;
  label?: string | null;
  favorite?: boolean;
  checked?: boolean;
  selected?: boolean;
  small?: boolean;
  tooltip?: string;
  /** Set to make the tile draggable. */
  origin?: DragOrigin;
}>();
defineEmits<{ pick: [unit: Unit] }>();

function onPointerDown(event: PointerEvent) {
  if (props.origin) startDrag(event, props.unit, props.origin);
}
</script>

<template>
  <button
    type="button"
    class="tile"
    :class="{ small, selected, checked, draggable: origin, lifted: drag.unit?.id === unit.id }"
    :title="tooltip ?? titledName(unit)"
    @pointerdown="onPointerDown"
    @click="$emit('pick', unit)"
  >
    <span class="frame">
      <UnitCard :unit="unit" />
      <span v-if="checked" class="check" aria-label="In team">✓</span>
      <span v-else-if="unit.formOf != null" class="form" title="Transformed form">↻</span>
      <span v-if="favorite" class="star" aria-label="Favorite">★</span>
    </span>
    <span v-if="label" class="label">{{ label }}</span>
  </button>
</template>

<style scoped>
/* A button only grows to fit its content, and the card art is absolutely positioned, so give it the full width. */
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
}
.tile:hover { background: none; }
.tile.draggable { cursor: grab; }
.tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

.frame {
  position: relative;
  display: block;
  transition: transform 0.12s ease, filter 0.12s ease;
}
.tile:hover .frame { transform: translateY(-2px); filter: brightness(1.08); }
.selected .frame { filter: drop-shadow(0 0 1px var(--accent)) drop-shadow(0 0 3px var(--accent)); }
.checked .card { opacity: 0.45; }
.lifted .frame { opacity: 0.35; }

.check,
.form,
.star {
  position: absolute;
  z-index: 6;
  display: grid;
  place-items: center;
  line-height: 1;
  pointer-events: none;
}
.check {
  left: 0;
  top: 2px;
  width: 22%;
  min-width: 15px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--good);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 0 0 2px var(--panel);
}
.form {
  left: 0;
  top: 2px;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgb(0 0 0 / 0.65);
  color: #fff;
  font-size: 11px;
}
.star {
  right: 4%;
  bottom: 12%;
  color: var(--accent);
  font-size: 14px;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.8);
}

.label {
  overflow: hidden;
  padding: 1px 3px;
  border-radius: 4px;
  background: var(--panel-2);
  font-size: 0.74rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.small .label { font-size: 0.68rem; }
.small .star { font-size: 11px; }
</style>
