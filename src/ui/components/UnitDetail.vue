<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { bestLeadersFor, linkingPartners, sharedLinks, unitsBoostedBy } from '../../core/analysis.ts';
import { formatMonth } from '../../core/browse.ts';
import type { Unit } from '../../core/types.ts';
import {
  addToTeam,
  favorites,
  fieldableUnits,
  filterByCategory,
  isInTeam,
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
import UnitTile from './UnitTile.vue';

type Tab = 'details' | 'partners' | 'leads' | 'leaders';
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
  if (!unit.value) return other.name;
  const links = sharedLinks(unit.value, other);
  return `${other.name} — ${other.title}\n${links.length} shared: ${links.join(', ')}`;
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
      <UnitTile :unit="unit" :favorite="favorites.has(unit.id)" class="portrait" />
      <div class="identity">
        <div class="muted small">{{ unit.title }}</div>
        <h2>{{ unit.name }}</h2>
        <div class="row small">
          <span class="chip">{{ unit.rarity }}</span>
          <span class="chip" :class="`type-${unit.type}`"><span class="dot" />{{ unit.class }} {{ unit.type }}</span>
          <span v-if="unit.cost != null" class="chip">Cost {{ unit.cost }}</span>
          <span v-if="unit.releaseDate" class="chip" :title="unit.releaseDate">Released {{ formatMonth(unit.releaseDate) }}</span>
          <span v-if="unit.formOf != null" class="chip">Transformed form</span>
        </div>
        <div class="row actions">
          <button v-if="unit.formOf == null" type="button" :class="{ active: isInTeam(unit) }" @click="toggleTeam">
            {{ isInTeam(unit) ? '✓ In team' : '+ Add to team' }}
          </button>
          <button type="button" :aria-pressed="favorites.has(unit.id)" @click="toggleFavorite(unit)">★ Favorite</button>
          <button
            v-if="unit.eza"
            type="button"
            :aria-pressed="showingEza"
            title="Show Extreme Z-Awakened text and leader skill"
            @click="settings.useEza = !settings.useEza"
          >EZA</button>
        </div>
      </div>
    </header>

    <nav class="tabs" aria-label="Unit details">
      <button type="button" :class="{ active: tab === 'details' }" @click="tab = 'details'">Details</button>
      <button type="button" :class="{ active: tab === 'partners' }" @click="tab = 'partners'">Linking partners</button>
      <button v-if="unit.formOf == null" type="button" :class="{ active: tab === 'leads' }" @click="tab = 'leads'">
        As leader
      </button>
      <button type="button" :class="{ active: tab === 'leaders' }" @click="tab = 'leaders'">Best leaders</button>
    </nav>

    <div class="body">
      <template v-if="tab === 'details'">
        <div class="stats">
          <div><span class="muted small">HP</span><strong>{{ unit.hp.toLocaleString('en-US') }}</strong></div>
          <div><span class="muted small">ATK</span><strong>{{ unit.atk.toLocaleString('en-US') }}</strong></div>
          <div><span class="muted small">DEF</span><strong>{{ unit.def.toLocaleString('en-US') }}</strong></div>
          <div v-if="unit.kiMultiplier"><span class="muted small">Ki multiplier</span><strong>{{ unit.kiMultiplier.replace(/^12 Ki Multiplier is /, '') }}</strong></div>
        </div>
        <p class="muted small note">Stats at max level with every Hidden Potential node.</p>

        <div v-if="relatedForms.length" class="block">
          <h3>{{ baseUnit ? 'Base card and other forms' : 'Transforms into' }}</h3>
          <div class="tile-grid related">
            <UnitTile v-for="related in relatedForms" :key="related.id" :unit="related" small :label="related.name" @pick="selectUnit" />
          </div>
        </div>

        <div class="block">
          <h3>Leader skill <span v-if="unit.leader" class="chip boost">up to {{ unit.maxBoost }}%</span></h3>
          <p><CategoryText :text="skills.leaderSkill || '—'" /></p>
          <p v-if="unit.formOf == null && !unit.leader && skills.leaderSkill" class="muted small">
            This leader skill has conditions, so it isn't counted in the leader tools.
          </p>
        </div>
        <div class="block">
          <h3>Super Attack</h3>
          <p>{{ skills.superAttack || '—' }}</p>
        </div>
        <div v-if="skills.ultraSuperAttack" class="block">
          <h3>Ultra Super Attack</h3>
          <p>{{ skills.ultraSuperAttack }}</p>
        </div>
        <div class="block">
          <h3>Passive skill</h3>
          <p class="pre"><CategoryText :text="skills.passive || '—'" /></p>
        </div>
        <div v-if="showingEza && unit.superEzaPassive" class="block">
          <h3>Super Extreme passive</h3>
          <p class="pre"><CategoryText :text="unit.superEzaPassive" /></p>
        </div>
        <div v-if="skills.activeSkill" class="block">
          <h3>Active skill</h3>
          <p>{{ skills.activeSkill }}</p>
          <p v-if="skills.activeSkillCondition" class="muted small">{{ skills.activeSkillCondition }}</p>
        </div>
        <div v-if="unit.transformationCondition && unit.transformationCondition !== skills.activeSkillCondition" class="block">
          <h3>Transformation condition</h3>
          <p>{{ unit.transformationCondition }}</p>
        </div>
        <div class="block">
          <h3>Links</h3>
          <div class="row">
            <span v-for="link in unit.links" :key="link" class="chip">{{ link }}</span>
            <span v-if="unit.links.length === 0" class="muted small">None</span>
          </div>
        </div>
        <div class="block">
          <h3>Categories</h3>
          <div class="row">
            <button
              v-for="category in unit.categories"
              :key="category"
              type="button"
              class="chip"
              :title="`Show ${category} units`"
              @click="filterByCategory(category)"
            >{{ category }}</button>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'partners'">
        <p v-if="partners.length === 0" class="empty">No unit shares two or more links with this one.</p>
        <div v-for="group in partners" :key="group.count" class="block">
          <h3>{{ group.count }} shared links <span class="muted small">({{ group.units.length }})</span></h3>
          <div class="tile-grid">
            <UnitTile
              v-for="partner in group.units"
              :key="partner.id"
              :unit="partner"
              small
              :tooltip="linkTooltip(partner)"
              :favorite="favorites.has(partner.id)"
              @pick="selectUnit"
            />
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'leads'">
        <p v-if="!unit.leader" class="empty">This leader skill has conditions or no stat boost, so it isn't counted here.</p>
        <p v-else-if="leads.length === 0" class="empty">No units are boosted by this leader.</p>
        <div v-for="group in leads" :key="group.boost" class="block">
          <h3>+{{ group.boost }}% <span class="muted small">({{ group.units.length }} units, most shared links first)</span></h3>
          <div class="tile-grid">
            <UnitTile
              v-for="entry in group.units"
              :key="entry.unit.id"
              :unit="entry.unit"
              small
              :label="`${entry.sharedLinks} links`"
              :tooltip="linkTooltip(entry.unit)"
              :favorite="favorites.has(entry.unit.id)"
              @pick="selectUnit"
            />
          </div>
        </div>
      </template>

      <template v-else>
        <p v-if="leaders.length === 0" class="empty">No leader skill without conditions boosts this unit.</p>
        <div v-else class="tile-grid">
          <UnitTile
            v-for="entry in leaders"
            :key="entry.leader.id"
            :unit="entry.leader"
            small
            :label="`${entry.boost}%`"
            :tooltip="`${entry.leader.name}: +${entry.boost}%, ${entry.sharedLinks} shared links`"
            :favorite="favorites.has(entry.leader.id)"
            @pick="selectUnit"
          />
        </div>
        <p class="muted small note">Top 20 leaders, ranked by boost and then shared links.</p>
      </template>
    </div>
  </section>
  <section v-else class="detail panel empty">Pick a unit to see its details.</section>
</template>

<style scoped>
.detail { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.head { display: flex; gap: 12px; padding: 12px; }
.portrait { width: 96px; flex: none; }
.identity { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
h2 { margin: 0; font-size: 1.15rem; line-height: 1.2; }
h3 { margin: 0 0 4px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--type); }
.actions { margin-top: 2px; }
.body { padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.block p { margin: 0; }
.pre { white-space: pre-line; }
.stats { display: flex; gap: 20px; flex-wrap: wrap; }
.stats div { display: flex; flex-direction: column; }
.stats strong { font-size: 1.05rem; }
.note { margin: -8px 0 0; }
.boost { text-transform: none; letter-spacing: 0; color: var(--text); }
.tile-grid { --tile: 58px; }
.tile-grid.related { --tile: 72px; }
</style>
