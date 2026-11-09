<script setup lang="ts">
import { computed } from 'vue';
import { BATTLEFIELD_TEAM_COUNT, FOLLOWERS_PER_TEAM, SLOTS_PER_TEAM } from '../../core/battlefield.ts';
import { titledName } from '../../core/browse.ts';
import { leaderBoost } from '../../core/leader.ts';
import type { Unit } from '../../core/types.ts';
import { drag } from '../drag.ts';
import {
  activeBattlefieldTeam,
  battlefield,
  clearBattlefieldTeamAt,
  clearWholeBattlefield,
  removeBattlefieldUnit,
  unitsById,
  usedInBattlefield,
} from '../store.ts';
import UnitTile from './UnitTile.vue';

interface Slot {
  role: string;
  unit: Unit | null;
  boost1: number;
  boost2: number;
}

const teams = computed(() =>
  battlefield.value.map(team => {
    const leader1 = team.leader1 != null ? unitsById.value.get(team.leader1) ?? null : null;
    const leader2 = team.leader2 != null ? unitsById.value.get(team.leader2) ?? null : null;
    const slot = (role: string, unit: Unit | null): Slot => ({
      role,
      unit,
      boost1: unit && leader1 ? leaderBoost(leader1.leader, unit) : 0,
      boost2: unit && leader2 ? leaderBoost(leader2.leader, unit) : 0,
    });
    const followers = Array.from({ length: FOLLOWERS_PER_TEAM }, (_, index) => {
      const id = team.followers[index];
      return slot('', id != null ? unitsById.value.get(id) ?? null : null);
    });
    const slots = [slot('Leader', leader1), slot('Friend', leader2), ...followers];
    return { slots, filled: slots.filter(entry => entry.unit).length, leader1, leader2 };
  }),
);

const target = computed(() => (drag.unit && drag.target?.kind === 'battlefield' ? drag.target : null));

function slotTitle(slot: Slot, leader1: Unit | null, leader2: Unit | null) {
  if (!slot.unit) return '';
  const describe = (leader: Unit | null, boost: number, label: string) =>
    leader ? `${label} (${titledName(leader)}): ${boost > 0 ? `+${boost}%` : 'no boost'}` : `${label}: empty`;
  return `${titledName(slot.unit)}\n${describe(leader1, slot.boost1, 'Leader')}\n${describe(leader2, slot.boost2, 'Friend')}`;
}

function clearAll() {
  if (usedInBattlefield.value.size === 0 || window.confirm('Clear all 16 Battlefield teams?')) clearWholeBattlefield();
}
</script>

<template>
  <section class="board panel">
    <header class="row spread head">
      <div>
        <h2>Battlefield</h2>
        <span class="muted small">{{ usedInBattlefield.size }} of {{ BATTLEFIELD_TEAM_COUNT * SLOTS_PER_TEAM }} placed</span>
      </div>
      <button type="button" class="danger" :disabled="usedInBattlefield.size === 0" @click="clearAll">Clear all</button>
    </header>
    <p class="muted small help">
      Tap a unit to add it to the selected team, or drag it onto any slot. Drag placed units to move them, or out to take them off.
    </p>

    <div class="teams" data-drag-scroll>
      <article
        v-for="(team, teamIndex) in teams"
        :key="teamIndex"
        class="team"
        data-drop="battlefield"
        :data-team="teamIndex"
        :class="{ active: activeBattlefieldTeam === teamIndex, 'drop-target': target?.team === teamIndex }"
        @click="activeBattlefieldTeam = teamIndex"
      >
        <header class="row spread">
          <button type="button" class="team-name" :aria-pressed="activeBattlefieldTeam === teamIndex">Team {{ teamIndex + 1 }}</button>
          <span class="muted small count">{{ team.filled }}/{{ SLOTS_PER_TEAM }}</span>
          <button type="button" class="link small" :disabled="team.filled === 0" @click.stop="clearBattlefieldTeamAt(teamIndex)">Clear</button>
        </header>
        <div class="slots">
          <div
            v-for="(slot, slotIndex) in team.slots"
            :key="slotIndex"
            class="slot"
            :data-slot="slotIndex"
            :class="{ leader: slotIndex < 2, 'drop-target': target?.team === teamIndex && target.slot === slotIndex }"
          >
            <template v-if="slot.unit">
              <UnitTile
                :unit="slot.unit"
                small
                :tooltip="`${slotTitle(slot, team.leader1, team.leader2)}\nTap to take off`"
                :origin="{ kind: 'battlefield', team: teamIndex, slot: slotIndex }"
                @pick="removeBattlefieldUnit(slot.unit.id)"
              />
              <span class="boosts" aria-hidden="true">
                <span :class="{ on: slot.boost1 > 0 }">L</span><span :class="{ on: slot.boost2 > 0 }">F</span>
              </span>
            </template>
            <span v-else class="placeholder">{{ slot.role }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.board { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.head { flex: none; padding: 10px 12px 0; }
h2 { margin: 0; font-size: 1.05rem; }
.help { flex: none; margin: 4px 12px 0; }
.teams {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 10px;
  align-content: start;
  padding: 12px;
  overflow-y: auto;
}
.team {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel-2);
  cursor: pointer;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.team.active { border-color: var(--accent); }
.team.drop-target { border-color: var(--good); box-shadow: inset 0 0 0 1px var(--good); }
.team-name { padding: 0; border: 0; background: none; font-weight: 700; }
.team-name[aria-pressed='true'] { background: none; color: var(--accent); }
.count { margin-left: auto; margin-right: 8px; font-variant-numeric: tabular-nums; }

.slots { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 6px; }
.slot { position: relative; min-width: 0; padding-bottom: 12px; }
.slot.drop-target::after {
  content: '';
  position: absolute;
  inset: -2px -2px 10px;
  border: 2px solid var(--good);
  border-radius: 8px;
  pointer-events: none;
}
.placeholder {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--muted);
  font-size: 0.62rem;
}
.slot.leader .placeholder { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }

.boosts {
  position: absolute;
  left: 50%;
  bottom: 0;
  display: flex;
  gap: 2px;
  transform: translateX(-50%);
}
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

@media (max-width: 420px) {
  .teams { grid-template-columns: 1fr; }
}
</style>
