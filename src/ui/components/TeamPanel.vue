<script setup lang="ts">
import { computed, ref } from 'vue';
import { commonLeaders, linkEdges, possibleTeams, teamLinkCounts } from '../../core/analysis.ts';
import { titledName } from '../../core/browse.ts';
import type { Unit } from '../../core/types.ts';
import { drag } from '../drag.ts';
import type { DragOrigin } from '../drag.ts';
import {
  clearTeam,
  favorites,
  removeFromTeam,
  resetRotations,
  rotations,
  rotationsRearranged,
  selectUnit,
  selectedId,
  settings,
  team,
  units,
} from '../store.ts';
import LinkGraph from './LinkGraph.vue';
import UnitTile from './UnitTile.vue';

type Tab = 'links' | 'rotations' | 'leaders' | 'teams';

const TEAM_ORIGIN: DragOrigin = { kind: 'team' };
const LIST_ORIGIN: DragOrigin = { kind: 'list' };
const ROTATION_ORIGIN: DragOrigin = { kind: 'rotation' };
const tab = ref<Tab>('links');
const removing = ref(false);

const edges = computed(() => (tab.value === 'links' ? linkEdges(team.value, settings.minimumLinks) : []));
const linkCounts = computed(() => (tab.value === 'links' ? teamLinkCounts(team.value) : []));
const leaders = computed(() => (tab.value === 'leaders' ? commonLeaders(team.value, units.value).slice(0, 40) : []));
const teams = computed(() => (tab.value === 'teams' ? possibleTeams(team.value) : []));

// While a unit is dragged over the panel: undefined when not over it, null for "at the end", else the id it goes before.
const insertBefore = computed(() => (drag.unit && drag.target?.kind === 'team' ? drag.target.beforeId : undefined));
const draggingOut = computed(() => drag.origin?.kind === 'team' && drag.target == null);
// The rotation member a dragged member would swap with.
const swapWith = computed(() =>
  drag.unit && drag.target?.kind === 'rotation' && drag.target.unitId !== drag.unit.id ? drag.target.unitId : null,
);

function pickMember(unit: Unit) {
  if (removing.value) removeFromTeam(unit);
  else selectUnit(unit);
}

function changeMinimum(delta: number) {
  settings.minimumLinks = Math.min(7, Math.max(1, settings.minimumLinks + delta));
}
</script>

<template>
  <section class="team panel" data-drop="team" :class="{ 'drop-target': insertBefore !== undefined, 'drag-out': draggingOut }">
    <header class="row spread head">
      <h2>Team</h2>
      <div class="row">
        <button type="button" :aria-pressed="removing" :disabled="team.length === 0" title="Tap members to remove them" @click="removing = !removing">
          {{ removing ? 'Done' : 'Remove' }}
        </button>
        <button type="button" class="danger" :disabled="team.length === 0" @click="clearTeam(); removing = false">Clear</button>
      </div>
    </header>

    <div v-if="team.length" class="tile-grid members" :class="{ removing, 'insert-end': insertBefore === null }" data-drag-scroll>
      <UnitTile
        v-for="(member, index) in team"
        :key="member.id"
        :unit="member"
        small
        :data-member="member.id"
        :data-next="team[index + 1]?.id ?? ''"
        :class="{ 'insert-before': insertBefore === member.id }"
        :selected="!removing && selectedId === member.id"
        :favorite="favorites.has(member.id)"
        :tooltip="removing ? `Remove ${titledName(member)}` : titledName(member)"
        :origin="TEAM_ORIGIN"
        @pick="pickMember"
      />
    </div>
    <p v-else class="empty small drop-hint">Drag units here, or use “+ Add to team”.</p>

    <nav class="tabs" aria-label="Team tools">
      <button type="button" :class="{ active: tab === 'links' }" @click="tab = 'links'">Shared links</button>
      <button type="button" :class="{ active: tab === 'rotations' }" @click="tab = 'rotations'">Rotations</button>
      <button type="button" :class="{ active: tab === 'leaders' }" @click="tab = 'leaders'">Common leaders</button>
      <button type="button" :class="{ active: tab === 'teams' }" @click="tab = 'teams'">Possible teams</button>
    </nav>

    <div class="body" data-drag-scroll>
      <template v-if="tab === 'links'">
        <div class="row spread">
          <span class="muted small">Minimum shared links</span>
          <div class="row stepper">
            <button type="button" aria-label="Fewer links" @click="changeMinimum(-1)">−</button>
            <strong>{{ settings.minimumLinks }}</strong>
            <button type="button" aria-label="More links" @click="changeMinimum(1)">+</button>
          </div>
        </div>
        <p v-if="team.length < 2" class="empty">Add at least two units to see their links.</p>
        <template v-else>
          <LinkGraph :units="team" :edges="edges" @pick="selectUnit" />
          <section v-if="linkCounts.length">
            <h3>Links in this team</h3>
            <ul class="link-list">
              <li v-for="entry in linkCounts" :key="entry.link" class="row spread">
                <span>{{ entry.link }}</span>
                <span class="muted small" :title="entry.units.map(titledName).join('\n')">{{ entry.units.length }} of {{ team.length }}</span>
              </li>
            </ul>
          </section>
        </template>
      </template>

      <template v-else-if="tab === 'rotations'">
        <p v-if="!rotations" class="empty">Add at least two units to plan rotations.</p>
        <template v-else>
          <div class="row note">
            <p class="muted small">
              A rotation is a pair that comes in together every other turn, so pairs that share more links get more out of
              them. Drag a unit onto another to swap them.
            </p>
            <button v-if="rotationsRearranged" type="button" @click="resetRotations()">Best rotations</button>
          </div>
          <div class="rotations" data-drop="rotation">
            <article v-for="(pair, index) in rotations.rotations" :key="index" class="rotation">
              <h3>
                Rotation {{ index + 1 }}
                <span class="aside">{{ pair.links.length }} shared {{ pair.links.length === 1 ? 'link' : 'links' }}</span>
              </h3>
              <div class="row pair">
                <UnitTile
                  v-for="member in pair.units"
                  :key="member.id"
                  :unit="member"
                  small
                  class="pair-unit"
                  :class="{ 'swap-target': swapWith === member.id }"
                  :data-rotation-unit="member.id"
                  :origin="ROTATION_ORIGIN"
                  @pick="selectUnit"
                />
                <div class="row chips">
                  <span v-for="link in pair.links" :key="link" class="chip">{{ link }}</span>
                </div>
              </div>
            </article>
            <article v-if="rotations.floaters.length" class="rotation">
              <h3>Floaters<span class="aside">fill the third slot each turn</span></h3>
              <div class="row">
                <UnitTile
                  v-for="member in rotations.floaters"
                  :key="member.id"
                  :unit="member"
                  small
                  class="pair-unit"
                  :class="{ 'swap-target': swapWith === member.id }"
                  :data-rotation-unit="member.id"
                  :origin="ROTATION_ORIGIN"
                  @pick="selectUnit"
                />
              </div>
            </article>
          </div>
        </template>
      </template>

      <template v-else-if="tab === 'leaders'">
        <p v-if="team.length === 0" class="empty">Add units to find leaders that boost all of them.</p>
        <p v-else-if="leaders.length === 0" class="empty">No single leader boosts every member.</p>
        <template v-else>
          <p class="muted small">Leaders that boost everyone, labeled with the smallest boost any member gets.</p>
          <div class="tile-grid">
            <UnitTile
              v-for="entry in leaders"
              :key="entry.leader.id"
              :unit="entry.leader"
              small
              :label="`${entry.boost}%`"
              :tooltip="`${titledName(entry.leader)}\nAt least +${entry.boost}% to everyone, ${entry.sharedLinks} shared links in total`"
              :favorite="favorites.has(entry.leader.id)"
              :origin="LIST_ORIGIN"
              @pick="selectUnit"
            />
          </div>
        </template>
      </template>

      <template v-else>
        <div class="row spread">
          <label class="row small toggle"><input v-model="settings.maxBoostOnly" type="checkbox" /> Top boost only</label>
        </div>
        <p v-if="teams.length === 0" class="empty">None of the members has a leader skill without conditions.</p>
        <article v-for="option in teams" :key="option.leader.id" class="option">
          <div class="row option-head">
            <UnitTile :unit="option.leader" small class="leader" :origin="LIST_ORIGIN" @pick="selectUnit" />
            <div class="stack">
              <strong>{{ option.leader.name }}</strong>
              <span class="muted small">Boosts {{ option.boostedCount }} of {{ team.length - 1 }}</span>
              <div v-if="option.sharedCategories.length" class="row small">
                <span v-for="category in option.sharedCategories" :key="category" class="chip">{{ category }}</span>
              </div>
            </div>
          </div>
          <div v-for="group in settings.maxBoostOnly ? option.groups.slice(0, 1) : option.groups" :key="group.boost" class="row group">
            <span class="boost">+{{ group.boost }}%</span>
            <UnitTile
              v-for="entry in group.units"
              :key="entry.unit.id"
              :unit="entry.unit"
              small
              class="member"
              :tooltip="`${titledName(entry.unit)}\n${entry.sharedLinks} links with the leader`"
              :origin="LIST_ORIGIN"
              @pick="selectUnit"
            />
          </div>
        </article>
      </template>
    </div>
  </section>
</template>

<style scoped>
.team {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.team.drop-target { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.team.drag-out .members { opacity: 0.6; }

.head { padding: 10px 12px 0; }
h2 { margin: 0; font-size: 1.05rem; }
h3 { margin: 0 0 6px; font-size: 0.95rem; font-weight: 650; }

.members { --tile: 52px; max-height: 148px; padding: 10px 12px; overflow-y: auto; }
.members.removing .tile :deep(.card) { outline: 2px dashed var(--danger); outline-offset: -2px; border-radius: 10px; }
/* Accent bar showing where a dragged unit will land. */
.insert-before::before,
.members.insert-end::after {
  content: '';
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
}
.insert-before::before { position: absolute; left: -5px; top: 6%; bottom: 30%; }
.members.insert-end::after { justify-self: start; height: 70%; align-self: start; }
.drop-hint { margin: 10px 12px; border: 1px dashed var(--border); border-radius: var(--radius); }
.team.drop-target .drop-hint { border-color: var(--accent); color: var(--text); }

.head, .members, .drop-hint { flex: none; }
.body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 12px; overflow-y: auto; }
.body > * { flex-shrink: 0; }
.tile-grid { --tile: 58px; }
.stepper strong { min-width: 1.5em; text-align: center; font-variant-numeric: tabular-nums; }
.link-list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.toggle { cursor: pointer; }
.option { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius); }
.option-head { flex-wrap: nowrap; align-items: flex-start; }
.option-head .leader { width: 56px; flex: none; }
.group { gap: 6px; }
.group .member { width: 46px; }
.boost { min-width: 52px; font-weight: 700; font-variant-numeric: tabular-nums; }
.rotation { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius); }
.rotation h3 { margin: 0; display: flex; align-items: baseline; gap: 8px; }
.aside { color: var(--muted); font-size: 0.82rem; font-weight: 400; }
.pair { flex-wrap: nowrap; align-items: center; }
.pair-unit { width: 52px; flex: none; }
.chips { gap: 4px; }
.note { flex-wrap: nowrap; align-items: flex-start; justify-content: space-between; }
.note p { margin: 0; }
.note button { flex: none; }
.rotations { display: flex; flex-direction: column; gap: 12px; }
/* Outline on the member a dragged unit would swap with. */
.swap-target::after {
  content: '';
  position: absolute;
  inset: -3px;
  border: 2px solid var(--accent);
  border-radius: 9px;
  pointer-events: none;
}
</style>
