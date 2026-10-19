<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import WelcomeScreen from './components/WelcomeScreen.vue';
import SessionForm from './components/SessionForm.vue';
import PresentationPanel from './components/PresentationPanel.vue';
import { send } from './bridge.js';
import { defaultCategories, presentationChapters } from './data/location.js';
import { defaultChapterTargets } from './data/chapters.js';
import { defaultProjectTarget } from './data/project.js';
import { saveSessionArchive, listSessionArchives, getSessionArchive, deleteSessionArchive } from './api/localArchive.js';
import { createBrowserDataRuntime } from './api/browserDataRuntime.js';

const query = new URLSearchParams(location.search);
const panel = ['environment', 'toolbar', 'compass', 'session', 'saved', 'gallery', 'exit', 'navigation', 'description'].includes(query.get('panel')) ? query.get('panel') : 'full';
const isolated = ['environment', 'toolbar', 'compass', 'saved', 'gallery', 'exit', 'navigation', 'description'].includes(panel);
// Configure the gateway before child setup hooks can issue any API requests.
const dataRuntime = createBrowserDataRuntime(panel);
const cacheStatus = ref(null);
const cacheReadyCount = computed(() => cacheStatus.value?.tasks.filter(task=>task.state==='ready').length || 0);
const cacheHasErrors = computed(() => cacheStatus.value?.tasks.some(task=>task.state==='error') || false);
function onCacheStatus(event) { cacheStatus.value = event.detail; }
const previewView = panel === 'full' && query.get('mode') !== 'unreal' && (['apartments','saved','gallery'].includes(query.get('view')) || presentationChapters.some(item => item.id === query.get('view') && item.available)) ? query.get('view') : null;
const screen = ref(isolated || previewView ? 'presentation' : 'welcome');
const session = ref(null);
const clientPhone = ref(null);
const presentation = ref(null);
const form = ref(null);
const welcome = ref(null);
let savedFrame = 0;
let savedGeneration = 0;
async function prepareSaved() {
  if (panel !== 'saved') return;
  const generation = ++savedGeneration;
  cancelAnimationFrame(savedFrame);
  document.documentElement.dataset.savedPreparing = 'true';
  await nextTick();
  if (document.fonts?.ready) await document.fonts.ready;
  if (generation !== savedGeneration) return;
  let previous = '';
  let stable = 0;
  const check = () => {
    if (generation !== savedGeneration) return;
    const rect = document.querySelector('.saved-panel')?.getBoundingClientRect();
    if (!rect) return;
    const size = rect ? [innerWidth, innerHeight, rect.x, rect.y, rect.width, rect.height].join(':') : '';
    const valid = innerWidth > 1 && innerHeight > 1 && rect?.width > 0 && rect?.height > 0;
    stable = valid && size === previous ? stable + 1 : 0;
    previous = size;
    if (stable >= 3) {
      delete document.documentElement.dataset.savedPreparing;
      return;
    }
    savedFrame = requestAnimationFrame(check);
  };
  savedFrame = requestAnimationFrame(check);
}
function setWidgetState(value) {
  if (panel === 'saved' && value?.view === 'saved') {
    document.documentElement.dataset.savedPreparing = 'true';
  }
  presentation.value.setState(value);
  if (panel === 'saved' && value?.view === 'saved') prepareSaved();
}
function onSavedResize() {
  if (panel === 'saved' && presentation.value?.getState().view === 'saved') prepareSaved();
}
async function start() { screen.value = 'session'; await nextTick(); form.value.focus(); }
async function reset({ save = true } = {}) {
  const materials = presentation.value.apartmentApi.getMaterials();
  let archiveId = null;
  if (save) {
    try { archiveId = await saveSessionArchive(session.value, materials); }
    catch (error) { console.warn('IDEL: local archive failed', error); return false; }
  }
  if (session.value) send('session.ended', { savedLocally: !!archiveId, archiveId });
  session.value = null;
  clientPhone.value = null;
  screen.value = isolated ? 'presentation' : 'welcome';
  form.value.reset();
  presentation.value.setState({ hidden: false, view: 'home', categories: defaultCategories(), projectTarget: defaultProjectTarget, chapterTargets: defaultChapterTargets() });
  presentation.value.apartmentApi.resetMaterials();
  await nextTick();
  if (!isolated) welcome.value.focus();
  return true;
}
async function finish(value) {
  clientPhone.value = value.phone || null;
  session.value = { mode: value.mode, mock: value.mock, manager: value.manager, client: value.client?.id ? { id: value.client.id } : null };
  if (value.token) presentation.value.apartmentApi.setSessionToken(value.token);
  screen.value = panel === 'session' ? 'complete' : 'presentation';
  presentation.value.setState({ hidden: false });
  const snapshot = JSON.parse(JSON.stringify(session.value));
  window.dispatchEvent(new CustomEvent('idel-session', { detail: snapshot }));
  send('session.started', snapshot);
  await nextTick();
  if (screen.value === 'presentation') presentation.value.focus();
}
onMounted(() => {
  if(panel==='session')window.addEventListener('idel-cache-status',onCacheStatus);
  if (previewView) presentation.value.setState({ view: previewView });
  document.body.classList.toggle('preview', !isolated && query.get('mode') !== 'unreal');
  document.body.dataset.panel = panel;
  window.IdelWidget = { getState: () => presentation.value.getState(), setState: setWidgetState, selectObject: value => presentation.value.selectPresentationObject(value) };
  window.IdelApartments = presentation.value.apartmentApi;
  window.IdelData = dataRuntime.api;
  window.IdelSession = { getState: () => session.value ? JSON.parse(JSON.stringify(session.value)) : null, reset, listArchives: listSessionArchives, getArchive: getSessionArchive, deleteArchive: deleteSessionArchive };
  console.log('IDEL:DEBUG onMounted panel=' + panel + ' isolated=' + isolated);
  send('ui.ready', { version: 1, panel });
  dataRuntime.start();
  if (panel === 'saved') { window.addEventListener('resize', onSavedResize); prepareSaved(); }
});
onUnmounted(() => { window.removeEventListener('idel-cache-status',onCacheStatus); dataRuntime.dispose(); delete window.IdelData; savedGeneration++; cancelAnimationFrame(savedFrame); window.removeEventListener('resize', onSavedResize); delete document.documentElement.dataset.savedPreparing; delete window.IdelWidget; delete window.IdelSession; delete window.IdelApartments; delete document.body.dataset.panel; });
</script>

<template>
  <WelcomeScreen ref="welcome" :hidden="screen !== 'welcome'" @start="start" />
  <SessionForm ref="form" :hidden="screen !== 'session'" @close="reset" @enter="finish" />
  <PresentationPanel ref="presentation" :panel="panel" :preview="query.get('mode') !== 'unreal'" :end-session="reset" :hidden="screen !== 'presentation'" />
  <aside v-if="panel==='session' && cacheStatus?.started && screen!=='complete'" class="data-cache-status glass" role="status" aria-live="polite">
    <span>{{ cacheReadyCount === cacheStatus.tasks.length && !cacheStatus.running ? 'Данные презентации загружены' : `Подготовка данных: ${cacheReadyCount} из ${cacheStatus.tasks.length}` }}</span>
    <template v-if="cacheHasErrors"><span>Часть данных недоступна.</span><button type="button" @click="dataRuntime.api.retry()">Повторить загрузку</button></template>
  </aside>
</template>
