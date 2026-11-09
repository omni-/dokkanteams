<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { bestLeadersFor, linkingPartners, sharedLinks, unitsBoostedBy } from '../../core/analysis.ts';
import { formatMonth, titledName } from '../../core/browse.ts';
import type { Unit } from '../../core/types.ts';
import { art } from '../art.ts';
import type { DragOrigin } from '../drag.ts';
import {
  addToTeam,
  closeDetail,
  favorites,
  fieldableUnits,
  filterByCategory,
  isInTeam,
  linkSkills,
  removeFromTeam,
  selectUnit,
  selectedUnit,
  settings,
  skillsFor,
  toggleFavorite,
  units,
  unitsById,
} from '../store.ts';
import CategoryText from './CategoryText.vue';
import PassiveText from './PassiveText.vue';
import UnitCard from './UnitCard.vue';
import UnitTile from './UnitTile.vue';

type Tab = 'details' | 'partners' | 'leads' | 'leaders';

const LIST_ORIGIN: DragOrigin = { kind: 'list' };
const tab = ref<Tab>('details');

const unit = computed(() => selectedUnit.value);
const skills = computed(() => (unit.value ? skillsFor(unit.value) : null));
const showingEza = computed(() => Boolean(unit.value?.eza && settings.useEza));

const partners = computed(() => (unit.value && tab.value === 'partners' ? linkingPartners(unit.value, units.value) : []));
const leads = computed(() => (unit.value && tab.value === 'leads' ? unitsBoostedBy(unit.value, fieldableUnits.value) : []));
const leaders = computed(() => (unit.value && tab.value === 'leaders' ? bestLeadersFor(unit.value, units.value) : []));

const baseUnit = computed(() => (unit.value?.formOf != null ? unitsById.value.get(unit.value.formOf) ?? null : null));
const relatedForms = computed(() => {
  const owner = baseUnit.value ?? unit.value;
  if (!owner) return [];
  return [owner, ...owner.forms.map(id => unitsById.value.get(id))]
    .filter((related): related is Unit => related != null && related.id !== unit.value?.id);
});

// Leading only makes sense for cards you can field.
watch(unit, value => {
  if (value?.formOf != null && tab.value === 'leads') tab.value = 'details';
});

function linkTooltip(other: Unit) {
  if (!unit.value) return titledName(other);
  const links = sharedLinks(unit.value, other);
  return `${titledName(other)}\n${links.length} shared: ${links.join(', ')}`;
}

function linkTitle(link: string) {
  const effect = linkSkills.value[link]?.effect;
  return effect ? `${link}\n${effect} (Lv 10)` : link;
}

function toggleTeam() {
  if (!unit.value) return;
  if (isInTeam(unit.value)) removeFromTeam(unit.value);
  else addToTeam(unit.value);
}
</script>

<template>
  <section v-if="unit && skills" class="detail panel">
    <header class="head">
      <UnitCard :unit="unit" class="portrait" />
      <div class="identity">
        <p v-if="unit.title" class="title">[{{ unit.title }}]</p>
        <h2>{{ unit.name }}</h2>
        <p class="meta">
          <span v-if="unit.cost != null">Cost {{ unit.cost }}</span>
          <span v-if="unit.obtain">{{ unit.obtain === 'premium' ? 'Premium' : 'F2P' }}</span>
          <span v-if="unit.releaseDate" :title="unit.releaseDate">Released {{ formatMonth(unit.releaseDate) }}</span>
          <span v-if="unit.ezaReleaseDate" :title="unit.ezaReleaseDate">EZA {{ formatMonth(unit.ezaReleaseDate) }}</span>
          <span v-if="unit.superEzaReleaseDate" :title="unit.superEzaReleaseDate">Super EZA {{ formatMonth(unit.superEzaReleaseDate) }}</span>
          <span v-if="unit.formOf != null">Transformed form</span>
        </p>
        <div class="row actions">
          <button v-if="unit.formOf == null" type="button" :class="{ active: isInTeam(unit) }" @click="toggleTeam">
            {{ isInTeam(unit) ? '✓ In team' : '+ Add to team' }}
          </button>
          <button
            type="button"
            class="favorite"
            :aria-pressed="favorites.has(unit.id)"
            :aria-label="favorites.has(unit.id) ? 'Remove from favorites' : 'Add to favorites'"
            :title="favorites.has(unit.id) ? 'Remove from favorites' : 'Add to favorites'"
            @click="toggleFavorite(unit)"
          >★</button>
          <button
            v-if="unit.eza"
            type="button"
            class="eza"
            :aria-pressed="showingEza"
            :title="showingEza ? 'Showing the Extreme Z-Awakened kit. Click for the base kit.' : 'Show the Extreme Z-Awakened kit'"
            @click="settings.useEza = !settings.useEza"
          ><img :src="unit.superEzaPassive ? art.sezaBadge : art.ezaBadge" :alt="unit.superEzaPassive ? 'Super Extreme Z-Awaken' : 'Extreme Z-Awaken'" /></button>
        </div>
      </div>
      <button type="button" class="close" aria-label="Back to the unit list" title="Back to the unit list (Esc)" @click="closeDetail">✕</button>
    </header>

    <nav class="tabs" aria-label="Unit details">
      <button type="button" :class="{ active: tab === 'details' }" @click="tab = 'details'">Details</button>
      <button type="button" :class="{ active: tab === 'partners' }" @click="tab = 'partners'">Linking partners</button>
      <button v-if="unit.formOf == null" type="button" :class="{ active: tab === 'leads' }" @click="tab = 'leads'">As leader</button>
      <button type="button" :class="{ active: tab === 'leaders' }" @click="tab = 'leaders'">Best leaders</button>
    </nav>

    <div class="body" data-drag-scroll>
      <template v-if="tab === 'details'">
        <div class="stats" title="Max level with every Hidden Potential node">
          <div><span>HP</span><strong>{{ unit.hp.toLocaleString('en-US') }}</strong></div>
          <div><span>ATK</span><strong>{{ unit.atk.toLocaleString('en-US') }}</strong></div>
          <div><span>DEF</span><strong>{{ unit.def.toLocaleString('en-US') }}</strong></div>
          <div v-if="unit.kiMultiplier"><span>12 Ki</span><strong>{{ unit.kiMultiplier.replace(/^12 Ki Multiplier is /, '') }}</strong></div>
        </div>

        <section v-if="relatedForms.length" class="block">
          <h3>{{ baseUnit ? 'Base card and other forms' : 'Transforms into' }}</h3>
          <div class="tile-grid related">
            <UnitTile v-for="related in relatedForms" :key="related.id" :unit="related" small :label="related.name" :origin="LIST_ORIGIN" @pick="selectUnit" />
          </div>
        </section>

        <section class="block">
          <h3>Leader skill<span v-if="unit.leader" class="aside">up to {{ unit.maxBoost }}%</span></h3>
          <p><CategoryText :text="skills.leaderSkill || '—'" /></p>
          <p v-if="unit.formOf == null && !unit.leader && skills.leaderSkill" class="muted small">
            Has conditions, so the leader tools don't count it.
          </p>
        </section>
        <section class="block">
          <h3>Super Attack</h3>
          <p>{{ skills.superAttack || '—' }}</p>
        </section>
        <section v-if="skills.ultraSuperAttack" class="block">
          <h3>Ultra Super Attack</h3>
          <p>{{ skills.ultraSuperAttack }}</p>
        </section>
        <section class="block">
          <h3>Passive skill</h3>
          <PassiveText :text="skills.passive" />
        </section>
        <section v-if="showingEza && unit.superEzaPassive" class="block">
          <h3>Super EZA passive</h3>
          <PassiveText :text="unit.superEzaPassive" />
        </section>
        <section v-if="skills.activeSkill" class="block">
          <h3>Active skill</h3>
          <p>{{ skills.activeSkill }}</p>
          <p v-if="skills.activeSkillCondition" class="muted small">{{ skills.activeSkillCondition }}</p>
        </section>
        <section v-if="unit.transformationCondition && unit.transformationCondition !== skills.activeSkillCondition" class="block">
          <h3>Transformation condition</h3>
          <p>{{ unit.transformationCondition }}</p>
        </section>
        <section class="block">
          <h3>Links</h3>
          <div v-if="unit.links.length" class="plates">
            <span v-for="link in unit.links" :key="link" class="link-plate" :title="linkTitle(link)">{{ link }}</span>
          </div>
          <p v-else class="muted small">None</p>
        </section>
        <section class="block">
          <h3>Categories</h3>
          <div class="row categories">
            <button
              v-for="category in unit.categories"
              :key="category"
              type="button"
              class="chip"
              :title="`Show ${category} units`"
              @click="filterByCategory(category)"
            >{{ category }}</button>
          </div>
        </section>
      </template>

      <template v-else-if="tab === 'partners'">
        <p v-if="partners.length === 0" class="empty">No unit shares two or more links with this one.</p>
        <section v-for="group in partners" :key="group.count" class="block">
          <h3>{{ group.count }} shared links<span class="aside">{{ group.units.length }}</span></h3>
          <div class="tile-grid">
            <UnitTile
              v-for="partner in group.units"
              :key="partner.id"
              :unit="partner"
              small
              :tooltip="linkTooltip(partner)"
              :favorite="favorites.has(partner.id)"
              :origin="LIST_ORIGIN"
              @pick="selectUnit"
            />
          </div>
        </section>
      </template>

      <template v-else-if="tab === 'leads'">
        <p v-if="!unit.leader" class="empty">This leader skill has conditions or no stat boost, so it isn't counted here.</p>
        <p v-else-if="leads.length === 0" class="empty">No units are boosted by this leader.</p>
        <section v-for="group in leads" :key="group.boost" class="block">
          <h3>+{{ group.boost }}%<span class="aside">{{ group.units.length }} units, most shared links first</span></h3>
          <div class="tile-grid">
            <UnitTile
              v-for="entry in group.units"
              :key="entry.unit.id"
              :unit="entry.unit"
              small
              :label="`${entry.sharedLinks} links`"
              :tooltip="linkTooltip(entry.unit)"
              :favorite="favorites.has(entry.unit.id)"
              :origin="LIST_ORIGIN"
              @pick="selectUnit"
            />
          </div>
        </section>
      </template>

      <template v-else>
        <p v-if="leaders.length === 0" class="empty">No leader skill without conditions boosts this unit.</p>
        <section v-for="group in leaders" :key="group.boost" class="block">
          <h3>
            +{{ group.boost }}%
            <span class="aside">{{ group.units.length }} {{ group.units.length === 1 ? 'leader' : 'leaders' }}, most shared links first</span>
          </h3>
          <div class="tile-grid">
            <UnitTile
              v-for="entry in group.units"
              :key="entry.unit.id"
              :unit="entry.unit"
              small
              :label="`${entry.sharedLinks} links`"
              :tooltip="linkTooltip(entry.unit)"
              :favorite="favorites.has(entry.unit.id)"
              :origin="LIST_ORIGIN"
              @pick="selectUnit"
            />
          </div>
        </section>
      </template>
    </div>
  </section>
  <section v-else class="detail panel empty">Pick a unit to see its details.</section>
</template>

<style scoped>
.detail { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

.head { display: flex; gap: 14px; align-items: center; padding: 12px 14px; }
.portrait { width: 104px; flex: none; }
.identity { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.title { margin: 0; color: var(--muted); font-size: 0.85rem; }
h2 { margin: 0; font-size: 1.2rem; line-height: 1.2; }
.meta { margin: 0; color: var(--muted); font-size: 0.85rem; }
.meta span + span::before { content: '·'; margin: 0 6px; }
.actions { margin-top: 4px; }
.close {
  align-self: flex-start;
  margin-left: auto;
  padding: 2px 9px;
  border-color: transparent;
  background: none;
  color: var(--muted);
  font-size: 1rem;
}
.close:hover { color: var(--text); }
.favorite { color: var(--muted); font-size: 1rem; line-height: 1; padding: 5px 9px; }
.favorite[aria-pressed='true'] { background: var(--panel-2); border-color: var(--accent); color: var(--accent); }
.eza { padding: 0 4px; line-height: 0; background: none; }
.eza img { height: 30px; filter: grayscale(1); opacity: 0.5; transition: filter 0.12s, opacity 0.12s; }
.eza[aria-pressed='true'] { background: none; border-color: var(--accent); }
.eza[aria-pressed='true'] img { filter: none; opacity: 1; }

.head { flex: none; }
.body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; padding: 14px; overflow-y: auto; }
.body > * { flex-shrink: 0; }
h3 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 0.95rem;
  font-weight: 650;
}
.aside { color: var(--muted); font-size: 0.82rem; font-weight: 400; }
.block p { margin: 0; }
.block p + p { margin-top: 4px; }

.stats { display: flex; flex-wrap: wrap; gap: 8px 24px; }
.stats div { display: flex; flex-direction: column; }
.stats span { color: var(--muted); font-size: 0.8rem; }
.stats strong { font-size: 1.1rem; font-variant-numeric: tabular-nums; }

.plates { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.link-plate {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 6px;
  border: 7px solid transparent;
  border-image: url('../assets/link-plate.webp') 15 16 16 15 fill / 7px 8px 8px 7px stretch;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  text-shadow: 0 1px 1px rgb(0 0 0 / 0.9);
  white-space: nowrap;
}
.categories { gap: 6px; }

.tile-grid { --tile: 58px; }
.tile-grid.related { --tile: 72px; }

@media (max-width: 899px) {
  .portrait { width: 88px; }
  .close { display: none; }
}
</style>
