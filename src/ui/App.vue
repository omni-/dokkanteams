<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { art } from './art.ts';
import AboutDialog from './components/AboutDialog.vue';
import BattlefieldBoard from './components/BattlefieldBoard.vue';
import DragGhost from './components/DragGhost.vue';
import TeamPanel from './components/TeamPanel.vue';
import UnitBrowser from './components/UnitBrowser.vue';
import UnitDetail from './components/UnitDetail.vue';
import { drag } from './drag.ts';
import { closeDetail, dataset, detailOpen, loadData, loadError, page, team, toast, usedInBattlefield } from './store.ts';

type MobilePanel = 'browse' | 'detail' | 'team';

const about = ref<InstanceType<typeof AboutDialog> | null>(null);
// Phones show one panel at a time; wider screens show them side by side.
const mobilePanel = ref<MobilePanel>('browse');

watch(page, () => (mobilePanel.value = 'browse'));

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !detailOpen.value || drag.unit || document.querySelector('dialog[open]')) return;
  closeDetail();
}

onMounted(() => {
  loadData();
  window.addEventListener('keydown', onKeyDown);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <header class="app-header">
    <a class="brand" href="https://dokkandle.net/daily" title="Dokkandle">
      <img :src="art.logo" alt="Dokkandle" width="268" height="64" />
      <span>Team Builder</span>
    </a>
    <nav class="pages" aria-label="Pages">
      <button type="button" :class="{ active: page === 'team' }" @click="page = 'team'">Team tools</button>
      <button type="button" :class="{ active: page === 'battlefield' }" @click="page = 'battlefield'">Battlefield</button>
    </nav>
    <button type="button" class="about-button" @click="about?.open()">About</button>
  </header>

  <main v-if="loadError" class="message">
    <p>Couldn't load the character data: {{ loadError }}</p>
    <button type="button" @click="loadError = null; loadData()">Try again</button>
  </main>
  <main v-else-if="!dataset" class="message muted">Loading characters…</main>

  <main v-else class="layout" :class="[page, `show-${mobilePanel}`, { 'detail-open': detailOpen && page === 'team' }]">
    <UnitBrowser :mode="page" class="area-browse" @picked="mobilePanel = 'detail'" />
    <template v-if="page === 'team'">
      <UnitDetail class="area-detail" :class="{ closed: !detailOpen }" />
      <TeamPanel class="area-team" />
    </template>
    <BattlefieldBoard v-else class="area-team" />
  </main>

  <nav v-if="dataset" class="mobile-nav" aria-label="Panels">
    <button type="button" :class="{ active: mobilePanel === 'browse' }" @click="mobilePanel = 'browse'">Units</button>
    <button v-if="page === 'team'" type="button" :class="{ active: mobilePanel === 'detail' }" @click="mobilePanel = 'detail'">Details</button>
    <button type="button" :class="{ active: mobilePanel === 'team' }" @click="mobilePanel = 'team'">
      <template v-if="page === 'team'">Team ({{ team.length }})</template>
      <template v-else>Teams ({{ usedInBattlefield.size }})</template>
    </button>
  </nav>

  <AboutDialog ref="about" />
  <DragGhost />
  <div v-if="toast" :key="toast.id" class="toast" role="status">{{ toast.message }}</div>
</template>

<style scoped>
/* Header and panels line up on a centered column this wide. */
.app-header,
.layout { --content-width: 1440px; }

.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px max(16px, calc((100% - var(--content-width)) / 2));
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  height: 52px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
}
.brand img { width: auto; height: 26px; }
.brand span { font-weight: 650; letter-spacing: 0.01em; }
.pages { display: flex; gap: 4px; flex: 1; }
.about-button { margin-left: auto; }

.message { padding: 48px 16px; text-align: center; }

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas: 'list side';
  gap: var(--gap);
  padding: var(--gap) max(var(--gap), calc((100% - var(--content-width)) / 2));
  height: calc(100vh - 52px);
  height: calc(100dvh - 52px);
}
.layout.battlefield { grid-template-columns: minmax(340px, 4fr) 7fr; }
/* The details share the list's cell and cover it while open. */
.area-browse, .area-detail { grid-area: list; min-height: 0; }
.area-team { grid-area: side; min-height: 0; }

@media (min-width: 900px) {
  .area-detail.closed { display: none; }
  /* Hidden rather than removed, so the list keeps its scroll position. */
  .layout.detail-open .area-browse { visibility: hidden; }
}

.mobile-nav { display: none; }

@media (max-width: 899px) {
  .app-header { gap: 8px; padding: 8px 12px; }
  .brand img { height: 20px; }
  .brand span { display: none; }
  .layout, .layout.battlefield {
    display: block;
    height: auto;
    padding: 8px 8px 72px;
  }
  .layout > * { display: none; }
  .layout.show-browse .area-browse,
  .layout.show-detail .area-detail,
  .layout.show-team .area-team { display: flex; }
  .area-browse, .area-detail, .area-team { height: calc(100dvh - 52px - 80px); }
  .mobile-nav {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    gap: 4px;
    padding: 8px;
    background: var(--panel);
    border-top: 1px solid var(--border);
    z-index: 30;
  }
  .mobile-nav button { flex: 1; padding: 8px; }
}
</style>
