// Game art used directly in templates. Card frames, type and rarity icons live in UnitCard.vue's CSS.
import ezaBadge from './assets/eza.png';
import logo from './assets/dokkandle-logo.png';
import rarityLR from './assets/card/rarity-LR.png';
import rarityUR from './assets/card/rarity-UR.png';
import sezaBadge from './assets/seza.png';
import type { Rarity } from '../core/types.ts';

export const art = {
  logo,
  ezaBadge,
  sezaBadge,
  rarity: { LR: rarityLR, UR: rarityUR } satisfies Record<Rarity, string>,
};
