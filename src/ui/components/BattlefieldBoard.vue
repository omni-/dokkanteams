<script setup lang="ts">
import { computed } from 'vue';
import { BATTLEFIELD_TEAM_COUNT, FOLLOWERS_PER_TEAM } from '../../core/battlefield.ts';
import { leaderBoost } from '../../core/leader.ts';
import type { Unit } from '../../core/types.ts';
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

const SLOTS_PER_TEAM = 2 + FOLLOWERS_PER_TEAM;

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

function boostTitle(slot: Slot, leader1: Unit | null, leader2: Unit | null) {
  if (!slot.unit) return '';
  const describe = (leader: Unit | null, boost: number, label: string) =>
    leader ? `${label} (${leader.name}): ${boost > 0 ? `+${boost}%` : 'no boost'}` : `${label}: empty`;
  return `${slot.unit.name}\n${describe(leader1, slot.boost1, 'Leader')}\n${describe(leader2, slot.boost2, 'Friend')}\nClick to remove`;
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
        <span class="muted small">
          {{ usedInBattlefield.size }} / {{ BATTLEFIELD_TEAM_COUNT * SLOTS_PER_TEAM }} placed · each card can be used once
        </span>
      </div>
      <button type="button" class="danger" :disabled="usedInBattlefield.size === 0" @click="clearAll">Clear all</button>
    </header>
    <p class="muted small help">
      Pick a team, then tap units on the left to fill it: leader, friend, then five more. The dots on each card show
      whether the leader and the friend boost it. Tap a placed card to take it out.
    </p>

    <div class="teams">
      <article
        v-for="(team, teamIndex) in teams"
        :key="teamIndex"
        class="team"
        :class="{ active: activeBattlefieldTeam === teamIndex }"
        @click="activeBattlefieldTeam = teamIndex"
      >
        <header class="row spread">
          <button type="button" class="team-name" :aria-pressed="activeBattlefieldTeam === teamIndex">
            Team {{ teamIndex + 1 }}
          </button>
          <span class="muted small">{{ team.filled }}/{{ SLOTS_PER_TEAM }}</span>
          <button
            type="button"
            class="link small"
            :disabled="team.filled === 0"
            @click.stop="clearBattlefieldTeamAt(teamIndex)"
          >Clear</button>
        </header>
        <div class="slots">
          <div v-for="(slot, slotIndex) in team.slots" :key="slotIndex" class="slot" :class="{ leader: slotIndex < 2 }">
            <template v-if="slot.unit">
              <UnitTile
                :unit="slot.unit"
                small
                :tooltip="boostTitle(slot, team.leader1, team.leader2)"
                @pick="removeBattlefieldUnit(slot.unit.id)"
              />
              <span class="dots" aria-hidden="true">
                <span :class="slot.boost1 > 0 ? 'on' : 'off'" />
                <span :class="slot.boost2 > 0 ? 'on' : 'off'" />
              </span>
            </template>
            <span v-else class="placeholder">{{ slot.role || '+' }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.board { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.head { padding: 10px 12px 0; }
h2 { margin: 0; font-size: 1.05rem; }
.help { margin: 6px 12px 0; }
.teams {
  padding: 12px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 10px;
  align-content: start;
}
.team {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px;
  cursor: pointer;
  background: var(--panel-2);
}
.team.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.team-name { border: none; background: none; padding: 0; font-weight: 700; }
.team-name[aria-pressed='true'] { background: none; color: var(--accent); }
.slots { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 6px; }
.slot { position: relative; aspect-ratio: 1; min-width: 0; }
.slot.leader .placeholder { border-color: var(--accent); }
.placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 0.65rem;
  color: var(--muted);
}
.dots { position: absolute; left: 50%; bottom: -3px; transform: translateX(-50%); display: flex; gap: 3px; }
.dots span { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--panel); }
.dots .on { background: var(--good); }
.dots .off { background: var(--bad); }

@media (max-width: 420px) {
  .teams { grid-template-columns: 1fr; }
}
</style>
