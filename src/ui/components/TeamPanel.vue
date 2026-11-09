<script setup lang="ts">
import { computed, ref } from 'vue';
import { commonLeaders, linkEdges, possibleTeams, teamLinkCounts } from '../../core/analysis.ts';
import type { Unit } from '../../core/types.ts';
import { clearTeam, favorites, removeFromTeam, selectUnit, selectedId, settings, team, units } from '../store.ts';
import LinkGraph from './LinkGraph.vue';
import UnitTile from './UnitTile.vue';

type Tab = 'links' | 'leaders' | 'teams';
const tab = ref<Tab>('links');
const removing = ref(false);

const edges = computed(() => (tab.value === 'links' ? linkEdges(team.value, settings.minimumLinks) : []));
const linkCounts = computed(() => (tab.value === 'links' ? teamLinkCounts(team.value) : []));
const leaders = computed(() => (tab.value === 'leaders' ? commonLeaders(team.value, units.value).slice(0, 40) : []));
const teams = computed(() => (tab.value === 'teams' ? possibleTeams(team.value) : []));

function pickMember(unit: Unit) {
  if (removing.value) removeFromTeam(unit);
  else selectUnit(unit);
}

function changeMinimum(delta: number) {
  settings.minimumLinks = Math.min(7, Math.max(1, settings.minimumLinks + delta));
}
</script>

<template>
  <section class="team panel">
    <header class="row spread head">
      <h2>Team <span class="muted">({{ team.length }})</span></h2>
      <div class="row">
        <button type="button" :aria-pressed="removing" :disabled="team.length === 0" title="Tap members to remove them" @click="removing = !removing">
          {{ removing ? 'Done' : 'Remove…' }}
        </button>
        <button type="button" class="danger" :disabled="team.length === 0" @click="clearTeam(); removing = false">Clear</button>
      </div>
    </header>

    <div v-if="team.length" class="tile-grid members" :class="{ removing }">
      <UnitTile
        v-for="member in team"
        :key="member.id"
        :unit="member"
        small
        :selected="!removing && selectedId === member.id"
        :favorite="favorites.has(member.id)"
        :tooltip="removing ? `Remove ${member.name}` : `${member.name} — ${member.title}`"
        @pick="pickMember"
      />
    </div>
    <p v-else class="empty small">Add units with “+ Add to team” or turn on Quick add, then compare them here.</p>

    <nav class="tabs" aria-label="Team tools">
      <button type="button" :class="{ active: tab === 'links' }" @click="tab = 'links'">Shared links</button>
      <button type="button" :class="{ active: tab === 'leaders' }" @click="tab = 'leaders'">Common leaders</button>
      <button type="button" :class="{ active: tab === 'teams' }" @click="tab = 'teams'">Possible teams</button>
    </nav>

    <div class="body">
      <template v-if="tab === 'links'">
        <div class="row spread">
          <span class="muted small">Lines join units sharing at least this many links.</span>
          <div class="row stepper">
            <button type="button" aria-label="Fewer links" @click="changeMinimum(-1)">−</button>
            <strong>{{ settings.minimumLinks }}</strong>
            <button type="button" aria-label="More links" @click="changeMinimum(1)">+</button>
          </div>
        </div>
        <p v-if="team.length < 2" class="empty">Add at least two units to see their links.</p>
        <template v-else>
          <LinkGraph :units="team" :edges="edges" @pick="selectUnit" />
          <div v-if="linkCounts.length" class="block">
            <h3>Links held by more than one member</h3>
            <ul class="link-list">
              <li v-for="entry in linkCounts" :key="entry.link" class="row spread">
                <span>{{ entry.link }}</span>
                <span class="muted small" :title="entry.units.map(unit => unit.name).join(', ')">{{ entry.units.length }} / {{ team.length }}</span>
              </li>
            </ul>
          </div>
        </template>
      </template>

      <template v-else-if="tab === 'leaders'">
        <p v-if="team.length === 0" class="empty">Add units to find leaders that boost all of them.</p>
        <p v-else-if="leaders.length === 0" class="empty">No single leader boosts every member.</p>
        <template v-else>
          <p class="muted small">Leaders that boost every member, ranked by the smallest boost any member gets.</p>
          <div class="tile-grid">
            <UnitTile
              v-for="entry in leaders"
              :key="entry.leader.id"
              :unit="entry.leader"
              small
              :label="`${entry.boost}%`"
              :tooltip="`${entry.leader.name}: at least +${entry.boost}% to everyone, ${entry.sharedLinks} shared links in total`"
              :favorite="favorites.has(entry.leader.id)"
              @pick="selectUnit"
            />
          </div>
        </template>
      </template>

      <template v-else>
        <div class="row spread">
          <span class="muted small">What each member would do as leader for the rest.</span>
          <label class="row small toggle"><input v-model="settings.maxBoostOnly" type="checkbox" /> Top boost only</label>
        </div>
        <p v-if="teams.length === 0" class="empty">None of the members has a leader skill without conditions.</p>
        <article v-for="option in teams" :key="option.leader.id" class="option">
          <div class="row option-head">
            <UnitTile :unit="option.leader" small class="leader" @pick="selectUnit" />
            <div class="stack">
              <strong>{{ option.leader.name }}</strong>
              <span class="muted small">Boosts {{ option.boostedCount }} of {{ team.length - 1 }} others</span>
              <div v-if="option.sharedCategories.length" class="row small">
                <span class="muted">Shared:</span>
                <span v-for="category in option.sharedCategories" :key="category" class="chip">{{ category }}</span>
              </div>
            </div>
          </div>
          <div v-for="group in settings.maxBoostOnly ? option.groups.slice(0, 1) : option.groups" :key="group.boost" class="row group">
            <span class="chip boost">+{{ group.boost }}%</span>
            <UnitTile
              v-for="entry in group.units"
              :key="entry.unit.id"
              :unit="entry.unit"
              small
              class="member"
              :tooltip="`${entry.unit.name}: ${entry.sharedLinks} links with the leader`"
              @pick="selectUnit"
            />
          </div>
        </article>
      </template>
    </div>
  </section>
</template>

<style scoped>
.team { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.head { padding: 10px 12px 0; }
h2 { margin: 0; font-size: 1.05rem; }
h3 { margin: 0 0 4px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.members { padding: 10px 12px; --tile: 52px; }
.members.removing :deep(.portrait) { outline: 2px dashed var(--danger); outline-offset: 1px; }
.body { padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.tile-grid { --tile: 58px; }
.stepper strong { min-width: 1.5em; text-align: center; }
.link-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.toggle { cursor: pointer; }
.option { border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.option-head { flex-wrap: nowrap; align-items: flex-start; }
.leader { width: 56px; flex: none; }
.group { gap: 6px; }
.member { width: 46px; }
.boost { min-width: 56px; justify-content: center; font-weight: 700; }
</style>
