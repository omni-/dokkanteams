<script setup lang="ts">
import { computed, ref } from 'vue';
import { FRIEND_ID, commonLeaders, linkEdges, possibleTeams, teamLinkCounts } from '../../core/analysis.ts';
import type { RotationMember, RotationSpot } from '../../core/analysis.ts';
import { titledName } from '../../core/browse.ts';
import { formatLinkStats, linkStatTotals } from '../../core/links.ts';
import type { Unit } from '../../core/types.ts';
import { art } from '../art.ts';
import { drag } from '../drag.ts';
import type { DragOrigin } from '../drag.ts';
import {
  arrangeBestRotations,
  clearFriend,
  clearTeam,
  dropPreview,
  favorites,
  lead,
  leader,
  linkSkills,
  makeLeader,
  pickingFriend,
  removeFromTeam,
  rotations,
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
const FRIEND_ORIGIN: DragOrigin = { kind: 'friend' };
const LIST_ORIGIN: DragOrigin = { kind: 'list' };
const tab = ref<Tab>('links');
const removing = ref(false);

/** The friend slot's card. Only shown with asymmetric lead; otherwise the friend is a copy of the leader. */
const friend = computed(() => (settings.asymmetricLead ? lead.value.friend : null));
const lineupEmpty = computed(() => team.value.length === 0 && friend.value == null);

const edges = computed(() => (tab.value === 'links' ? linkEdges(team.value, settings.minimumLinks) : []));
const linkCounts = computed(() => (tab.value === 'links' ? teamLinkCounts(team.value) : []));
const leaders = computed(() => (tab.value === 'leaders' ? commonLeaders(team.value, units.value).slice(0, 40) : []));
const teams = computed(() => (tab.value === 'teams' ? possibleTeams(team.value) : []));

// While a unit is dragged over the panel: undefined when not over it, null for "at the end", else the id it goes before.
const insertBefore = computed(() => (drag.unit && drag.target?.kind === 'team' ? drag.target.beforeId : undefined));
const draggingOut = computed(() => drag.origin?.kind === 'team' && drag.target == null);
const friendDropTarget = computed(() =>
  drag.unit != null && drag.origin != null && drag.target?.kind === 'friend' && dropPreview(drag.unit, drag.origin, drag.target) !== 'none',
);
const draggingFriendOut = computed(() => drag.origin?.kind === 'friend' && drag.target == null);
// The rotation spot a dragged unit would land on, to outline it.
const landingSpot = computed(() => {
  if (!drag.unit || !drag.origin || drag.target?.kind !== 'rotation' || !drag.target.spot) return null;
  return dropPreview(drag.unit, drag.origin, drag.target) === 'none' ? null : spotKey(drag.target.spot);
});

function spotKey(spot: RotationSpot) {
  if (spot.kind === 'unit') return `unit:${spot.unitId}`;
  if (spot.kind === 'slot') return `slot:${spot.rotation}-${spot.position}`;
  return 'floaters';
}

function linkTotals(links: readonly string[]) {
  return formatLinkStats(linkStatTotals(links, linkSkills.value));
}

function linkEffect(link: string) {
  return linkSkills.value[link]?.effect;
}

function pickMember(unit: Unit) {
  if (removing.value) removeFromTeam(unit);
  else selectUnit(unit);
}

// Clicking the friend slot, empty or not, waits for a tap in the unit list to choose the friend.
function pickFriendSlot() {
  if (removing.value) clearFriend();
  else pickingFriend.value = !pickingFriend.value;
}

function friendTooltip(unit: Unit | null) {
  if (removing.value && unit) return `Remove ${titledName(unit)}`;
  if (pickingFriend.value) return 'Tap a unit in the list to make it the friend, or click here to cancel';
  const action = 'Click, then tap a unit in the list, or drag a unit here';
  return unit ? `Friend: ${titledName(unit)}\n${action} to change it` : `Friend: ${action}`;
}

function rotationOrigin(member: RotationMember): DragOrigin {
  return { kind: 'rotation', member: member.id };
}

function clearLineup() {
  clearTeam();
  removing.value = false;
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
        <label class="row small toggle" title="Pick a different friend instead of a copy of your leader">
          <input v-model="settings.asymmetricLead" type="checkbox" /> Enable asymmetric lead
        </label>
        <button type="button" :aria-pressed="removing" :disabled="lineupEmpty" title="Tap members to remove them" @click="removing = !removing">
          {{ removing ? 'Done' : 'Remove' }}
        </button>
        <button type="button" class="danger" :disabled="lineupEmpty" @click="clearLineup">Clear</button>
      </div>
    </header>

    <div class="lineup" :class="{ removing }">
      <div v-if="team.length" class="tile-grid members" :class="{ 'insert-end': insertBefore === null }" data-drag-scroll>
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
          :tooltip="removing ? `Remove ${titledName(member)}` : index === 0 ? `Leader: ${titledName(member)}` : titledName(member)"
          :origin="TEAM_ORIGIN"
          @pick="pickMember"
        >
          <img v-if="index === 0" class="role-badge" :src="art.leaderBadge" alt="Leader" />
        </UnitTile>
      </div>
      <p v-else class="empty small drop-hint">Drag units here, or use “+ Add to team”. The first one leads.</p>

      <div
        v-if="settings.asymmetricLead"
        class="friend-slot"
        data-drop="friend"
        :class="{ 'drop-target': friendDropTarget, 'drag-out': draggingFriendOut, picking: pickingFriend }"
      >
        <UnitTile
          v-if="friend"
          :unit="friend"
          small
          class="friend"
          :favorite="favorites.has(friend.id)"
          :tooltip="friendTooltip(friend)"
          :origin="FRIEND_ORIGIN"
          @pick="pickFriendSlot"
        >
          <img class="role-badge" :src="art.friendBadge" alt="Friend" />
        </UnitTile>
        <template v-else>
          <button
            type="button"
            class="add-friend"
            :aria-pressed="pickingFriend"
            aria-label="Choose the friend"
            :title="friendTooltip(null)"
            @click="pickFriendSlot"
          >+</button>
          <img class="role-badge" :src="art.friendBadge" alt="" />
        </template>
      </div>
    </div>

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
                <span class="stack">
                  <span>{{ entry.link }}</span>
                  <span v-if="linkEffect(entry.link)" class="muted small" title="At link level 10">{{ linkEffect(entry.link) }}</span>
                </span>
                <span class="muted small count" :title="entry.units.map(titledName).join('\n')">{{ entry.units.length }} of {{ team.length }}</span>
              </li>
            </ul>
          </section>
        </template>
      </template>

      <template v-else-if="tab === 'rotations'">
        <p v-if="!rotations" class="empty">Add units to plan rotations.</p>
        <template v-else>
          <div class="row toolbar">
            <button
              type="button"
              :disabled="team.length < 2"
              title="Pair up the members that share the most links"
              @click="arrangeBestRotations()"
            >Best rotations</button>
          </div>
          <div class="rotations" data-drop="rotation">
            <article v-for="(pair, index) in rotations.rotations" :key="index" class="rotation">
              <h3>
                Rotation {{ index + 1 }}
                <span class="aside">{{ pair.links.length }} shared {{ pair.links.length === 1 ? 'link' : 'links' }}</span>
              </h3>
              <div class="row pair">
                <template v-for="(member, position) in pair.units" :key="member?.id ?? `empty-${position}`">
                  <UnitTile
                    v-if="member"
                    :unit="member.unit"
                    small
                    class="pair-unit"
                    :class="{ 'swap-target': landingSpot === `unit:${member.id}`, friend: member.id === FRIEND_ID }"
                    :data-rotation-unit="member.id"
                    :origin="rotationOrigin(member)"
                    @pick="selectUnit"
                  >
                    <img v-if="member.id === FRIEND_ID" class="role-badge" :src="art.friendBadge" alt="Friend" />
                    <img v-else-if="member.id === leader?.id" class="role-badge" :src="art.leaderBadge" alt="Leader" />
                  </UnitTile>
                  <div
                    v-else
                    class="pair-unit open-spot"
                    :class="{ 'swap-target': landingSpot === `slot:${index}-${position}` }"
                    :data-rotation-slot="`${index}-${position}`"
                    title="Open spot: drag a unit here"
                  ></div>
                </template>
                <div class="row chips">
                  <span v-for="link in pair.links" :key="link" class="chip" :title="linkEffect(link)">{{ link }}</span>
                </div>
              </div>
              <p
                v-if="linkTotals(pair.links)"
                class="link-totals"
                title="Both units get these, at link level 10. Includes effects with conditions; hover a link to see them."
              >Each gets {{ linkTotals(pair.links) }}</p>
            </article>
            <article class="rotation" :class="{ 'drop-here': landingSpot === 'floaters' }" data-rotation-floaters>
              <h3>Floaters<span class="aside">fill the third slot each turn</span></h3>
              <div v-if="rotations.floaters.length" class="row">
                <UnitTile
                  v-for="member in rotations.floaters"
                  :key="member.id"
                  :unit="member.unit"
                  small
                  class="pair-unit"
                  :class="{ 'swap-target': landingSpot === `unit:${member.id}`, friend: member.id === FRIEND_ID }"
                  :data-rotation-unit="member.id"
                  :origin="rotationOrigin(member)"
                  @pick="selectUnit"
                >
                  <img v-if="member.id === FRIEND_ID" class="role-badge" :src="art.friendBadge" alt="Friend" />
                  <img v-else-if="member.id === leader?.id" class="role-badge" :src="art.leaderBadge" alt="Leader" />
                </UnitTile>
              </div>
              <p v-else class="muted small">Drag a unit here to make it a floater.</p>
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
              :tooltip="`${titledName(entry.leader)}\nEveryone qualifies for the ${entry.boost}% tier or higher\n${entry.sharedLinks} shared links in total`"
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
        <p v-else class="muted small">Click one to make it your leader.</p>
        <!-- The leader tile is the keyboard target: its click bubbles up to the card. -->
        <article
          v-for="option in teams"
          :key="option.leader.id"
          class="option"
          :class="{ current: option.leader.id === leader?.id }"
          :title="option.leader.id === leader?.id ? undefined : `Make ${titledName(option.leader)} the leader`"
          @click="makeLeader(option.leader)"
        >
          <div class="row option-head">
            <UnitTile :unit="option.leader" small class="leader" :origin="LIST_ORIGIN">
              <img v-if="option.leader.id === leader?.id" class="role-badge" :src="art.leaderBadge" alt="Leader" />
            </UnitTile>
            <div class="stack">
              <strong>{{ option.leader.name }}</strong>
              <span class="muted small">Boosts {{ option.boostedCount }} of {{ team.length - 1 }}</span>
              <div v-if="option.sharedCategories.length" class="row small">
                <span v-for="category in option.sharedCategories" :key="category" class="chip">{{ category }}</span>
              </div>
            </div>          </div>
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
              @click.stop
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

.lineup { display: flex; align-items: flex-start; }
.lineup .members { flex: 1; min-width: 0; }
.lineup .drop-hint { flex: 1; }
.members { --tile: 52px; max-height: 148px; padding: 10px 12px; overflow-y: auto; }
.lineup.removing .tile :deep(.card) { outline: 2px dashed var(--danger); outline-offset: -2px; border-radius: 10px; }
/* The game's LEADER and FRIEND stickers, across the card's top-left corner and tilted as in the game. */
.role-badge {
  position: absolute;
  z-index: 7;
  left: -12%;
  top: 0;
  width: 84%;
  height: auto;
  transform: rotate(-5deg);
  transition: transform 0.12s ease;
  pointer-events: none;
}
.tile:hover .role-badge { transform: translateY(-2px) rotate(-5deg); }
.friend :deep(.frame) { outline: 2px solid var(--good); outline-offset: 1px; border-radius: 8px; }

.friend-slot {
  position: relative;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 52px;
  margin: 10px 12px 10px 0;
  border-radius: 9px;
  transition: box-shadow 0.12s, opacity 0.12s;
}
.friend-slot.picking,
.friend-slot.drop-target { box-shadow: 0 0 0 3px var(--panel), 0 0 0 5px var(--good); }
.friend-slot.drag-out { opacity: 0.5; }
.add-friend,
.add-friend[aria-pressed='true'] {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  padding: 0;
  border: 2px solid var(--good);
  border-radius: 8px;
  background: color-mix(in srgb, var(--good) 14%, transparent);
  color: var(--good);
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
}
.add-friend:hover { background: color-mix(in srgb, var(--good) 24%, transparent); }
.add-friend[aria-pressed='true'] { background: var(--good); color: #fff; }
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

.head, .lineup { flex: none; }
.body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 12px; overflow-y: auto; }
.body > * { flex-shrink: 0; }
.tile-grid { --tile: 58px; }
.stepper strong { min-width: 1.5em; text-align: center; font-variant-numeric: tabular-nums; }
.link-list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.link-list li { flex-wrap: nowrap; align-items: flex-start; }
.link-list .stack { gap: 1px; }
.link-list .count { flex: none; }
.toggle { cursor: pointer; }
.option {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.option:hover { background: var(--panel-2); }
.option.current { border-color: var(--accent); cursor: default; }
.option.current:hover { background: none; }
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
.toolbar { justify-content: flex-end; }
.rotations { display: flex; flex-direction: column; gap: 12px; }
.rotation p { margin: 0; }
.link-totals { font-size: 0.85rem; font-weight: 600; }
.open-spot {
  position: relative;
  aspect-ratio: 1;
  border: 2px dashed var(--border);
  border-radius: 8px;
}
.rotation.drop-here { border-color: var(--accent); }
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
