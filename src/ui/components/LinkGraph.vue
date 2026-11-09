<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import type { LinkEdge } from '../../core/analysis.ts';
import type { Unit } from '../../core/types.ts';

const props = defineProps<{ units: Unit[]; edges: LinkEdge[] }>();
defineEmits<{ pick: [unit: Unit] }>();

const SIZE = 400;
const clipPrefix = useId();
const base = import.meta.env.BASE_URL;
const hovered = ref<number | null>(null);

const nodeRadius = computed(() => (props.units.length > 12 ? 17 : props.units.length > 8 ? 21 : 26));

// Units sit on a circle; with a small team that is easier to read than a force layout.
const nodes = computed(() => {
  const count = props.units.length;
  const ring = count <= 1 ? 0 : SIZE / 2 - nodeRadius.value - 14;
  return props.units.map((unit, index) => {
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    return { unit, x: SIZE / 2 + ring * Math.cos(angle), y: SIZE / 2 + ring * Math.sin(angle) };
  });
});

const positions = computed(() => new Map(nodes.value.map(node => [node.unit.id, node])));

const lines = computed(() =>
  props.edges.flatMap(edge => {
    const source = positions.value.get(edge.source);
    const target = positions.value.get(edge.target);
    if (!source || !target) return [];
    const touched = hovered.value == null || hovered.value === edge.source || hovered.value === edge.target;
    return [{
      key: `${edge.source}-${edge.target}`,
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      count: edge.links.length,
      title: `${source.unit.name} & ${target.unit.name}: ${edge.links.join(', ')}`,
      touched,
    }];
  }),
);
</script>

<template>
  <svg class="graph" :viewBox="`0 0 ${SIZE} ${SIZE}`" role="img" aria-label="Shared links between team members">
    <defs>
      <clipPath v-for="node in nodes" :id="`${clipPrefix}-${node.unit.id}`" :key="node.unit.id">
        <circle :cx="node.x" :cy="node.y" :r="nodeRadius" />
      </clipPath>
    </defs>
    <g v-for="line in lines" :key="line.key" class="edge" :class="{ faded: !line.touched }">
      <title>{{ line.title }}</title>
      <line :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" :stroke-width="1 + line.count * 0.7" />
      <circle :cx="(line.x1 + line.x2) / 2" :cy="(line.y1 + line.y2) / 2" r="10" />
      <text :x="(line.x1 + line.x2) / 2" :y="(line.y1 + line.y2) / 2">{{ line.count }}</text>
    </g>
    <g
      v-for="node in nodes"
      :key="node.unit.id"
      class="node"
      :class="`type-${node.unit.type}`"
      tabindex="0"
      @mouseenter="hovered = node.unit.id"
      @mouseleave="hovered = null"
      @focus="hovered = node.unit.id"
      @blur="hovered = null"
      @click="$emit('pick', node.unit)"
      @keydown.enter="$emit('pick', node.unit)"
    >
      <title>{{ node.unit.name }}</title>
      <circle :cx="node.x" :cy="node.y" :r="nodeRadius + 2" class="ring" />
      <image
        :href="base + node.unit.image"
        :x="node.x - nodeRadius"
        :y="node.y - nodeRadius"
        :width="nodeRadius * 2"
        :height="nodeRadius * 2"
        :clip-path="`url(#${clipPrefix}-${node.unit.id})`"
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  </svg>
</template>

<style scoped>
.graph { width: 100%; max-width: 420px; display: block; margin: 0 auto; }
.edge line { stroke: var(--accent); stroke-opacity: 0.65; }
.edge circle { fill: var(--panel-3); stroke: var(--accent); }
.edge text { fill: var(--text); font-size: 11px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
.edge.faded { opacity: 0.12; }
.node { cursor: pointer; outline: none; }
.node .ring { fill: var(--panel); stroke: var(--type); stroke-width: 3; }
.node:hover .ring, .node:focus .ring { stroke: var(--accent); }
</style>
