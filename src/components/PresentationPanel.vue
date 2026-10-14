<script setup>
import { reactive, computed, ref, watch, onUnmounted, nextTick } from 'vue';
import { send } from '../bridge.js';
import LocationPanel from './LocationPanel.vue';
import ProjectPanel from './ProjectPanel.vue';
import ProjectDescription from './ProjectDescription.vue';
import { projectTargets, defaultProjectTarget } from '../data/project.js';
import { defaultCategories, presentationChapters } from '../data/location.js';
import { detailChapters, defaultChapterTargets, isChapterTarget, objectChapterIds } from '../data/chapters.js';
import { useApartments } from '../composables/useApartments.js';
import { usePresentationContent } from '../composables/usePresentationContent.js';
import ApartmentFilters from './ApartmentFilters.vue';
import ApartmentCard from './ApartmentCard.vue';
import ApartmentDetails from './ApartmentDetails.vue';
import ApartmentSceneControls from './ApartmentSceneControls.vue';
import ApartmentWindowView from './ApartmentWindowView.vue';
import SavedPanel from './SavedPanel.vue';
import GalleryPanel from './GalleryPanel.vue';
import { apartmentTitle, mediaUrl, priceText } from '../api/catalog.js';
const props = defineProps({ panel: { type: String, default: 'full' }, preview: Boolean, endSession: Function });
const root = ref(null);
const apartments = useApartments();
const apartmentState = apartments.state, hasApartmentSession = apartments.hasSession;
const state = reactive({ minutes: 988, season: 'summer', weather: 'clear', hidden: false, view: ['saved','gallery'].includes(props.panel) ? props.panel : 'home', categories: defaultCategories(), projectTarget: defaultProjectTarget, chapterTargets: defaultChapterTargets() });
const previousView = ref('home');
const windowViewIndex = ref(null);
watch(() => apartmentState.selectedId, (id, previous) => { if (id !== previous) windowViewIndex.value = null; });
const exitOpen = ref(false);
const exitError = ref('');
const notices = ref([]);
const noticeTimers = new Map();
let noticeSequence = 0;
let screenshotFlight = null;
let screenshotFlightToken = 0;
const { content: presentationContent, load: loadPresentationContent } = usePresentationContent(() => state.view);
const detailChapter = computed(() => {
  const chapter = detailChapters[state.view];
  if (!chapter) return null;
  const entries = presentationContent[state.view]?.items;
  return { ...chapter, targets: entries
    ? entries.map(item => ({ id: item.target, backendId: item.id, sceneObjectKey: item.sceneObjectKey, label: item.name, room: item.roomLabel || null, description: item.description }))
    : chapter.targets.map(item => ({ ...item, description: [] })) };
});
const selectedTargetId = computed(() => state.view === 'project' ? state.projectTarget : state.chapterTargets[state.view]);
const selectedProjectTarget = computed(() => detailChapter.value?.targets.find(item => item.id === selectedTargetId.value) || { label: selectedTargetId.value || 'Объект', description: [] });
const clock = computed(() => String(Math.floor(state.minutes / 60)).padStart(2, '0') + ':' + String(state.minutes % 60).padStart(2, '0'));
const visibilityLabel = computed(() => state.hidden ? 'Показать интерфейс' : 'Скрыть интерфейс');
watch(() => state.hidden, value => document.body.classList.toggle('ui-hidden', value));
onUnmounted(() => document.body.classList.remove('ui-hidden'));
onUnmounted(() => { for (const timer of noticeTimers.values()) clearTimeout(timer); cancelScreenshotFlight(); });
function removeNotice(id) { notices.value = notices.value.filter(item => item.id !== id); clearTimeout(noticeTimers.get(id)); noticeTimers.delete(id); }
function cancelScreenshotFlight() {
  screenshotFlightToken++;
  screenshotFlight?.remove();
  screenshotFlight = null;
}
function animateScreenshotToSaved(shot) {
  if (!['full', 'toolbar'].includes(props.panel) || state.hidden) return;
  const camera = root.value?.querySelector('[data-action="scene.screenshot"]');
  const heart = root.value?.querySelector('[data-action="ui.favorites"]');
  if (!camera || !heart) return;
  cancelScreenshotFlight();
  const token = screenshotFlightToken;
  const preview = new Image();
  preview.alt = '';
  preview.onload = () => {
    if (token !== screenshotFlightToken || !root.value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const compact = props.panel === 'toolbar';
    const width = compact ? 118 : 180;
    const height = width * 9 / 16;
    const cameraRect = camera.getBoundingClientRect();
    const heartRect = heart.getBoundingClientRect();
    const left = Math.max(4, Math.min(window.innerWidth - width - 4, cameraRect.left + cameraRect.width / 2 - width / 2));
    const top = compact ? 2 : Math.max(8, cameraRect.top - height - 18);
    const dx = heartRect.left + heartRect.width / 2 - left - width / 2;
    const dy = heartRect.top + heartRect.height / 2 - top - height / 2;
    const frame = document.createElement('div');
    frame.className = 'screenshot-flight';
    frame.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
    frame.append(preview);
    document.body.append(frame);
    screenshotFlight = frame;
    const flight = frame.animate([
      { transform: 'scale(.82)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1, offset: .18 },
      { transform: 'scale(1)', opacity: 1, offset: .42 },
      { transform: `translate(${dx}px, ${dy}px) scale(.14)`, opacity: .25 },
    ], { duration: 1050, easing: 'cubic-bezier(.25,.7,.16,1)' });
    flight.finished.then(() => {
      if (token !== screenshotFlightToken) return;
      frame.remove();
      screenshotFlight = null;
      heart.animate([
        { transform: 'scale(1)' }, { transform: 'scale(1.13)' }, { transform: 'scale(1)' },
      ], { duration: 300 });
    }).catch(() => {});
  };
  preview.src = shot.url;
}
function resetMaterials() { cancelScreenshotFlight(); apartments.resetMaterials(); windowViewIndex.value = null; notices.value = []; for (const timer of noticeTimers.values()) clearTimeout(timer); noticeTimers.clear(); exitOpen.value = false; }
function addNotice(kind, item) {
  const id = ++noticeSequence;
  notices.value = [{ id, kind, item }, ...notices.value].slice(0, 3);
  noticeTimers.set(id, setTimeout(() => removeNotice(id), 6000));
}
watch(() => apartmentState.screenshot?.id, id => {
  if (id && apartmentState.screenshot) {
    animateScreenshotToSaved(apartmentState.screenshot);
    if (props.panel === 'full') addNotice('screenshot', { ...apartmentState.screenshot });
  }
});
function setSeason(season) { state.season = season; send('scene.setSeason', {season}); }
function setWeather(weather) { state.weather = weather; send('scene.setWeather', {weather}); }
function sendTime() { send('scene.setTime', {minutes: state.minutes, hours: state.minutes / 60}); }
function action(method) {
  if (props.panel === 'toolbar' && ['ui.gallery','ui.favorites','ui.apartments'].includes(method)) {
    if (method === 'ui.apartments') { state.view = 'apartments'; send(method, { mode: 'facade', filters: apartments.snapshot().filters }); }
    else send(method);
    return;
  }
  if (method === 'ui.apartments') { state.view = 'apartments'; apartments.open(); return; }
  if (method === 'ui.favorites' || method === 'ui.gallery') {
    if (state.view !== 'saved' && state.view !== 'gallery') previousView.value = state.view;
    state.view = method === 'ui.favorites' ? 'saved' : 'gallery'; return;
  }
  if (method === 'scene.screenshot') { apartments.capture(); return; }
  if (['ui.info','scene.home'].includes(method)) { apartments.close(); windowViewIndex.value = null; }
  if (method === 'ui.info') state.view = state.view === 'home' ? 'location' : 'home';
  if (method === 'scene.home') state.view = 'home';
  if (method === 'ui.toggleVisibility') { state.hidden = !state.hidden; send(method, {visible: !state.hidden}); }
  else send(method);
}
function closeApartments() { apartments.close(); windowViewIndex.value = null; state.view = 'home'; }
function closeSaved() {
  if (['saved','gallery'].includes(props.panel)) send('ui.panel.close', { panel: props.panel });
  state.view = previousView.value;
}
async function finishSession(save) {
  exitError.value = '';
  if (await props.endSession?.({ save })) exitOpen.value = false;
  else exitError.value = 'Не удалось сохранить материалы на этом устройстве. Сессия осталась открытой.';
}
async function openSavedApartment(id) {
  if (props.panel === 'saved') { send('ui.saved.openApartment', { id }); return; }
  state.view = 'apartments';
  await apartments.open();
  if (await apartments.select({ id }, true)) await apartments.details();
}
async function toggleFavorite(propertyOrId = apartmentState.selected?.id) {
  const id = typeof propertyOrId === 'object' && propertyOrId ? propertyOrId.id : propertyOrId;
  const type = typeof propertyOrId === 'object' && propertyOrId ? propertyOrId.type : 'apartment';
  const before = apartmentState.favoriteItems.find(item => item.type === type && item.id === id);
  await apartments.toggleFavorite(propertyOrId);
  const after = apartmentState.favoriteItems.find(item => item.type === type && item.id === id);
  if (props.panel === 'saved' && !!before !== !!after) send('ui.saved.toggleFavorite', { type, id });
  if (!!before !== !!after) addNotice(after ? 'favorite' : 'removed', after || before);
}
function removeSavedScreenshot(id) {
  apartments.removeScreenshot(id);
  if (props.panel === 'saved') send('ui.saved.removeScreenshot', { id });
}
async function listApartmentAction({ id }, action) {
  const selected = await apartments.select({ id }, true);
  if (!selected) return;
  if (action === 'details') await apartments.details();
  else if (action === 'window') openWindowView();
  else apartments.requestView(action);
}
function openWindowView() {
  if (!apartmentState.selected) return;
  windowViewIndex.value = 2;
  apartments.requestView('window', { viewIndex: 2 });
}
function changeWindowView(index) {
  if (!apartmentState.selected || !Number.isInteger(index) || index < 1 || index > 3 || index === windowViewIndex.value) return;
  windowViewIndex.value = index;
  apartments.requestView('window', { viewIndex: index });
}
function closeWindowView() {
  if (windowViewIndex.value === null) return;
  windowViewIndex.value = null;
  send('scene.apartment.window.close', { id: apartmentState.selectedId });
}
function panWindowView(direction) {
  if (!['up','right','down','left'].includes(direction) || !apartmentState.selected || windowViewIndex.value === null) return;
  send('scene.apartment.window.pan', { id: apartmentState.selectedId, viewIndex: windowViewIndex.value, direction });
}
function retryApartments() { apartments.loadMetadata().catch(() => {}); apartments.refresh(); }
function toggleCategory(id) {
  state.categories = state.categories.includes(id) ? state.categories.filter(value => value !== id) : [...state.categories, id];
  send('scene.setInfrastructure', { categories: [...state.categories] });
}
async function selectChapter(chapter) {
  if (!presentationChapters.some(item => item.id === chapter && item.available) || state.view === chapter) return;
  apartments.close();
  state.view = chapter;
  send('ui.selectChapter', { chapter });
  await nextTick();
  root.value.querySelector(`[data-chapter="${chapter}"]`)?.focus();
}
function selectProjectTarget(target) {
  if (state.view !== 'project') {
    if (!isChapterTarget(state.view, target) || state.chapterTargets[state.view] === target) return;
    state.chapterTargets[state.view] = target;
    send('scene.selectChapterTarget', { chapter: state.view, target });
    return;
  }
  if (!detailChapter.value?.targets.some(item => item.id === target) || state.projectTarget === target) return;
  state.projectTarget = target;
  send('scene.selectProjectTarget', { target });
}
function setState(next) {
  if (!next || typeof next !== 'object') return;
  if (typeof next.minutes === 'number' && Number.isFinite(next.minutes)) state.minutes = Math.max(0, Math.min(1439, Math.round(next.minutes)));
  if (['summer', 'autumn', 'winter'].includes(next.season)) state.season = next.season;
  if (['clear', 'partlyCloudy', 'overcast', 'rain'].includes(next.weather)) state.weather = next.weather;
  if (typeof next.hidden === 'boolean') state.hidden = next.hidden;
  if (['home','apartments','saved','gallery'].includes(next.view) || presentationChapters.some(item => item.id === next.view && item.available)) {
    state.view = next.view;
    if (next.view !== 'apartments') { apartments.close(false); windowViewIndex.value = null; }
  }
  if (typeof next.projectTarget === 'string' && (projectTargets.some(item => item.id === next.projectTarget) || presentationContent.project?.items?.some(item => item.target === next.projectTarget))) state.projectTarget = next.projectTarget;
  if (Array.isArray(next.categories)) state.categories = defaultCategories().filter(id => next.categories.includes(id));
  if (next.chapterTargets && typeof next.chapterTargets === 'object' && !Array.isArray(next.chapterTargets)) {
    for (const chapter of objectChapterIds) {
      if (isChapterTarget(chapter, next.chapterTargets[chapter])) state.chapterTargets[chapter] = next.chapterTargets[chapter];
    }
  }
  if (next.materials && typeof next.materials === 'object') apartments.setMaterials(next.materials);
  if (state.view === 'apartments' && props.panel === 'full') return apartments.open(false).then(async () => {
    if (state.view !== 'apartments' || !apartmentState.active) return;
    await apartments.restore(next.apartments);
    if (next.apartments && 'windowViewIndex' in next.apartments) windowViewIndex.value = apartmentState.selected && Number.isInteger(next.apartments.windowViewIndex) && next.apartments.windowViewIndex >= 1 && next.apartments.windowViewIndex <= 3 ? next.apartments.windowViewIndex : null;
  });
}
defineExpose({setState, apartmentApi: { select: apartments.select, details: apartments.details, toggleFavorite: apartments.toggleFavorite, removeScreenshot: apartments.removeScreenshot, setFloor: apartments.setFloor, sceneReady: apartments.sceneReady, beginCapture: apartments.beginCapture, setScreenshot: apartments.setScreenshot, loadScreenshot: apartments.loadScreenshot, setSessionToken: apartments.setSessionToken, setMaterials: apartments.setMaterials, resetMaterials, getMaterials: apartments.getMaterials }, getState: () => ({...state, categories: [...state.categories], chapterTargets: {...state.chapterTargets}, apartments: {...apartments.snapshot(), windowViewIndex: windowViewIndex.value}}), focus: () => root.value.querySelector('button')?.focus()});
</script>
<template>
  <main ref="root" id="presentation" :class="{ 'window-active': windowViewIndex !== null }" :data-view="state.view" :inert="apartmentState.detailsOpen || windowViewIndex !== null" :aria-hidden="apartmentState.detailsOpen || windowViewIndex !== null || undefined" aria-label="Управление презентацией">
    <ApartmentSceneControls v-if="panel === 'full' && state.view === 'apartments'" :state="apartmentState" :preview="preview" :has-session="hasApartmentSession" @filter="apartments.setFilters" @floor="apartments.setFloor" @select="apartments.select($event,true)" @details="listApartmentAction($event, 'details')" @favorite="toggleFavorite($event.id)" @tour="listApartmentAction($event, 'tour')" @window-view="listApartmentAction($event, 'window')" @close-list="apartments.setMode('facade')" @close="closeApartments" />
    <SavedPanel v-if="(panel === 'full' || panel === 'saved') && state.view === 'saved'" :state="apartmentState" @close="closeSaved" @favorite="toggleFavorite" @remove-screenshot="removeSavedScreenshot" @open-apartment="openSavedApartment" />
    <GalleryPanel v-if="(panel === 'full' || panel === 'gallery') && state.view === 'gallery'" @close="closeSaved" />
    <LocationPanel v-if="panel === 'full' && state.view === 'location'" :categories="state.categories" :preview="preview"
      @toggle-category="toggleCategory" @select-chapter="selectChapter" />
    <ProjectPanel v-if="panel === 'full' && detailChapter" :chapter-data="detailChapter" :chapter="state.view" :target="selectedTargetId" :preview="preview"
      @select-target="selectProjectTarget" @select-chapter="selectChapter" />
    <section v-if="panel === 'full' || panel === 'environment'" class="top" :class="{ 'has-description': panel === 'full' && detailChapter }" aria-label="Окружение">
      <div class="glass project"><span>«Идель. Квартал на Сенной»</span><img src="assets/brand.svg" alt="" width="24" height="24"></div>
      <div class="glass logo"><img src="assets/logo.svg" alt="Идель" width="114" height="20"></div>
      <div class="glass environment">
        <div class="time-heading"><img src="assets/moon.svg" alt="" width="20" height="20"><output id="clock">{{ clock }}</output><img src="assets/horizon.svg" alt="" width="20" height="20"></div>
        <input id="time" type="range" min="0" max="1439" v-model.number="state.minutes" :style="{'--progress': (state.minutes / 1439 * 100) + '%'}" @input="sendTime" aria-label="Время суток">
        <div class="seasons" role="group" aria-label="Время года">
          <button data-season="summer" :aria-pressed="state.season === 'summer'" @click="setSeason('summer')">Весна / Лето</button><button data-season="autumn" :aria-pressed="state.season === 'autumn'" @click="setSeason('autumn')">Осень</button><button data-season="winter" :aria-pressed="state.season === 'winter'" @click="setSeason('winter')">Зима</button>
        </div>
        <div class="weather" role="group" aria-label="Погода">
          <button data-weather="clear" :aria-pressed="state.weather === 'clear'" @click="setWeather('clear')" aria-label="Ясно" title="Ясно"><img src="assets/sun.svg" alt=""></button>
          <button data-weather="partlyCloudy" :aria-pressed="state.weather === 'partlyCloudy'" @click="setWeather('partlyCloudy')" aria-label="Переменная облачность" title="Переменная облачность"><img src="assets/partly.svg" alt=""></button>
          <button data-weather="overcast" :aria-pressed="state.weather === 'overcast'" @click="setWeather('overcast')" aria-label="Пасмурно" title="Пасмурно"><img src="assets/cloud.svg" alt=""></button>
          <button data-weather="rain" :aria-pressed="state.weather === 'rain'" @click="setWeather('rain')" aria-label="Дождь" title="Дождь"><img src="assets/rain.svg" alt=""></button>
        </div>
      </div>
      <ApartmentFilters v-if="panel === 'full' && state.view === 'apartments'" :state="apartmentState" @filter="apartments.setFilters" @mode="apartments.setMode" @retry="retryApartments" />
      <div v-if="panel === 'full' && detailChapter" class="description-with-view">
        <ProjectDescription :target="selectedProjectTarget" :loading="presentationContent[state.view]?.loading" :error="presentationContent[state.view]?.error" @retry="loadPresentationContent(state.view)" />
        <button v-if="state.view === 'entrance'" class="interior-view glass" data-action="scene.requestInteriorView" title="Вид помещения"
          @click="send('scene.requestInteriorView', { target: selectedTargetId })">Вид
          <span class="location-icon"><img src="assets/chapters/entrance/caret-left.svg" alt=""></span>
        </button>
      </div>
    </section>
    <ApartmentCard v-if="panel === 'full' && state.view === 'apartments' && apartmentState.mode !== 'list'" :state="apartmentState" :has-session="hasApartmentSession" @details="apartments.details" @favorite="toggleFavorite" @tour="apartments.requestView('tour')" @window-view="openWindowView" @close="apartments.select({id:null},true)" @close-capture="apartments.clearCapture" @retry="apartments.select({id:apartmentState.selectedId})" />
    <div v-if="panel === 'full' && notices.length" class="saved-notices" aria-live="polite"><article v-for="notice in notices" :key="notice.id" class="saved-notice glass"><div><strong>{{ notice.kind === 'screenshot' ? 'Снимок сохранён' : notice.kind === 'favorite' ? 'Добавлено в избранное' : 'Удалено из избранного' }}</strong><button :aria-label="'Закрыть уведомление ' + notice.id" @click="removeNotice(notice.id)">×</button></div><img v-if="notice.kind === 'screenshot'" :src="notice.item.url" alt="Миниатюра снимка"><template v-else><img v-if="mediaUrl(notice.item.apartment?.planImage)" :src="mediaUrl(notice.item.apartment.planImage)" alt="Планировка"><p>{{ notice.item.type === 'apartment' ? apartmentTitle(notice.item) : notice.item.type === 'parking' ? 'Машино-место' : 'Кладовая' }}<br>{{ priceText(notice.item.price) }}</p></template></article></div>
    <button v-if="panel === 'full' || panel === 'compass'" class="compass" data-action="scene.resetNorth" @click="action('scene.resetNorth')" title="На север" aria-label="На север"><img src="assets/compass.svg" alt=""></button>
    <button v-if="panel === 'full' && state.view !== 'apartments'" class="session-exit glass" aria-label="Выйти из сессии" title="Выйти из сессии" @click="exitOpen = true">↪</button>
    <nav v-if="panel === 'full' || panel === 'toolbar'" class="bottom" aria-label="Действия">
      <div class="toolbar">
        <button data-action="scene.home" @click="action('scene.home')" :class="{primary: state.view === 'home'}" title="Домой" aria-label="Домой"><img src="assets/house.svg" alt=""></button>
        <button data-action="ui.info" @click="action('ui.info')" :class="{primary: !['home','apartments','saved','gallery'].includes(state.view)}" :aria-pressed="!['home','apartments','saved','gallery'].includes(state.view)" title="О проекте" aria-label="О проекте"><img src="assets/info.svg" alt=""></button>
        <button data-action="scene.screenshot" @click="action('scene.screenshot')" title="Снимок экрана" aria-label="Снимок экрана"><img src="assets/camera.svg" alt=""></button>
        <button id="visibility" data-action="ui.toggleVisibility" @click="action('ui.toggleVisibility')" :title="visibilityLabel" :aria-label="visibilityLabel" :aria-pressed="state.hidden"><img src="assets/hide.svg" alt=""></button>
        <button data-action="ui.gallery" :class="{primary: state.view === 'gallery'}" @click="action('ui.gallery')" title="Галерея" aria-label="Галерея"><img src="assets/gallery.svg" alt=""></button>
      </div>
      <div class="selection"><button class="apartments" :aria-pressed="state.view === 'apartments'" data-action="ui.apartments" @click="action('ui.apartments')"><img src="assets/buildings.svg" alt="">Выбор квартир</button><button data-action="ui.favorites" :aria-pressed="state.view === 'saved'" @click="action('ui.favorites')" title="Избранное" aria-label="Избранное"><img src="assets/heart.svg" alt=""></button></div>
    </nav>
    <Teleport to="body"><ApartmentWindowView v-if="panel === 'full' && state.view === 'apartments' && windowViewIndex !== null && apartmentState.selected" :state="apartmentState" :view-index="windowViewIndex" :preview="preview" :has-session="hasApartmentSession" @back="closeWindowView" @change="changeWindowView" @details="apartments.details" @favorite="toggleFavorite" @tour="apartments.requestView('tour')" @pan="panWindowView" @reset-north="send('scene.resetNorth')" /></Teleport>
    <Teleport to="body"><ApartmentDetails v-if="panel === 'full' && apartmentState.detailsOpen && state.view === 'apartments'" :state="apartmentState" :has-session="hasApartmentSession" @close="apartments.closeDetails" @favorite="toggleFavorite" @tour="apartments.requestView('tour')" @window-view="openWindowView" /></Teleport>
    <Teleport to="body"><div v-if="exitOpen" class="saved-backdrop" @click.self="exitOpen = false"><section class="session-exit-dialog glass" role="dialog" aria-modal="true" aria-label="Выйти из сессии"><button class="session-exit-close" aria-label="Закрыть" @click="exitOpen = false">×</button><div class="session-exit-icon">!</div><h2>Выйти из сессии?</h2><p>Избранные объекты можно сохранить на этом устройстве. Снимки доступны только до конца сессии.</p><p v-if="exitError" role="alert" class="apt-error">{{ exitError }}</p><div><button @click="exitOpen = false; action('ui.favorites')">Перейти в избранное</button><button @click="finishSession(true)">Сохранить избранное и выйти</button><button @click="finishSession(false)">Выйти без сохранения</button></div></section></div></Teleport>
  </main>
</template>
