<script setup lang="ts">
import type { Unit } from '../../core/types.ts';

defineProps<{ unit: Unit }>();

const base = import.meta.env.BASE_URL;
</script>

<!-- The in-game card icon: frame, LR lightning, portrait, type icon and rarity icon, laid out as DokkanDaily does. -->
<template>
  <span class="card" :class="[`r-${unit.rarity}`, `c-${unit.class}`, `t-${unit.type}`]">
    <span v-if="unit.rarity === 'LR'" class="lightning" aria-hidden="true" />
    <img
      class="art"
      :src="base + unit.image"
      :alt="unit.name"
      width="250"
      height="250"
      loading="lazy"
      decoding="async"
      draggable="false"
    />
  </span>
</template>

<style scoped>
.card {
  position: relative;
  display: block;
  aspect-ratio: 1;
  isolation: isolate;
  background: no-repeat 50% 40% / 71.429% 71.429%;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

/* ::before is the rarity icon, ::after the type icon. */
.card::before,
.card::after {
  content: '';
  position: absolute;
  background: no-repeat center / contain;
}
.card::before { left: 3.571%; top: 50.714%; width: 42.857%; height: 42.857%; z-index: 5; }
.card::after { left: 65%; top: 0; width: 34.357%; height: 34.357%; z-index: 4; }

.art,
.lightning {
  position: absolute;
  left: 5.357%;
  top: 0;
  width: 89.286%;
  height: 89.286%;
}
.art { z-index: 3; object-fit: contain; }
.lightning {
  z-index: 2;
  background: url('../assets/card/lr-lightning.webp') no-repeat center / contain;
}
@media (prefers-reduced-motion: reduce) {
  .lightning { background-image: url('../assets/card/lr-lightning-still.webp'); }
}

.t-AGL { background-image: url('../assets/card/bg-AGL.png'); }
.t-TEQ { background-image: url('../assets/card/bg-TEQ.png'); }
.t-INT { background-image: url('../assets/card/bg-INT.png'); }
.t-STR { background-image: url('../assets/card/bg-STR.png'); }
.t-PHY { background-image: url('../assets/card/bg-PHY.png'); }

.r-LR::before { background-image: url('../assets/card/rarity-LR.png'); }
.r-UR::before { background-image: url('../assets/card/rarity-UR.png'); }

.c-Super.t-AGL::after { background-image: url('../assets/card/type-Super-AGL.png'); }
.c-Super.t-TEQ::after { background-image: url('../assets/card/type-Super-TEQ.png'); }
.c-Super.t-INT::after { background-image: url('../assets/card/type-Super-INT.png'); }
.c-Super.t-STR::after { background-image: url('../assets/card/type-Super-STR.png'); }
.c-Super.t-PHY::after { background-image: url('../assets/card/type-Super-PHY.png'); }
.c-Extreme.t-AGL::after { background-image: url('../assets/card/type-Extreme-AGL.png'); }
.c-Extreme.t-TEQ::after { background-image: url('../assets/card/type-Extreme-TEQ.png'); }
.c-Extreme.t-INT::after { background-image: url('../assets/card/type-Extreme-INT.png'); }
.c-Extreme.t-STR::after { background-image: url('../assets/card/type-Extreme-STR.png'); }
.c-Extreme.t-PHY::after { background-image: url('../assets/card/type-Extreme-PHY.png'); }
</style>
