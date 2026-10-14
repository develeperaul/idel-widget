import { reactive, ref, onUnmounted } from 'vue';
import { send } from '../bridge.js';
import { catalogRequest, emptyApartmentFilters, loadProperties, mediaUrl } from '../api/catalog.js';

const copy = value => JSON.parse(JSON.stringify(value));
const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 4294967295;

export function useApartments() {
  const state = reactive({ active: false, mode: 'facade', floorView: null, filters: emptyApartmentFilters(), items: [], metadata: null, loading: false, error: '', selectedId: null, selected: null, selectionLoading: false, selectionError: '', detailsOpen: false, screenshot: null, screenshots: [], capturePending: false, captureError: '', favorites: [], favoriteItems: [], favoriteError: '', favoriteBusy: false, revision: 0 });
  const hasSession = ref(false);
  let sessionToken = '', listController, metadataController, detailController, captureTimer, captureSequence = 0, pendingCapture = null, readyRevision = null, resultsRevision = null, notifyResults = false;

  const snapshot = () => ({ mode: state.mode, floorView: state.floorView, filters: copy(state.filters), selectedId: state.selectedId, detailsOpen: state.detailsOpen, revision: state.revision });
  const sceneItems = () => state.items.map(item => ({ id: item.id, sceneObjectKey: item.sceneObjectKey || null, rooms: item.apartment?.rooms ?? null, status: item.status, floor: item.floor, sectionId: item.section?.id ?? null }));
  function highlightIfReady() {
    if (state.active && notifyResults && readyRevision === state.revision && resultsRevision === state.revision) {
      send('scene.apartments.highlight', { revision: state.revision, items: sceneItems(), selectedId: state.selectedId });
      notifyResults = false;
    }
  }
  function sceneReady({ revision } = {}) {
    if (!state.active || revision !== state.revision) return false;
    readyRevision = revision; highlightIfReady(); return true;
  }
  function clearCapture() {
    clearTimeout(captureTimer); pendingCapture = null;
    state.capturePending = false; state.captureError = ''; state.screenshot = null;
  }
  function clearSelection(notify = false) {
    detailController?.abort(); state.selectedId = null; state.selected = null; state.selectionError = ''; state.selectionLoading = false; state.detailsOpen = false; state.favoriteError = ''; clearCapture();
    if (notify) send('scene.apartments.select', { id: null, sceneObjectKey: null });
  }
  async function loadMetadata() {
    metadataController?.abort(); metadataController = new AbortController();
    const query = new URLSearchParams({ type: 'apartment' });
    ['available', 'reserved', 'sold'].forEach(status => query.append('status[]', status));
    const data = await catalogRequest(`properties/filters?${query}`, { signal: metadataController.signal });
    if (!data.options || !data.bounds) throw new Error('Неверный ответ фильтров');
    state.metadata = data;
  }
  async function refresh(notify = true) {
    listController?.abort(); listController = new AbortController();
    const revision = ++state.revision;
    state.loading = true; state.error = ''; state.items = []; resultsRevision = null; notifyResults = notify; readyRevision = null;
    if (notify) send('scene.apartments.query', { ...snapshot(), context: {} });
    try {
      const items = await loadProperties(copy(state.filters), listController.signal);
      if (revision !== state.revision || !state.active) return;
      state.items = items; resultsRevision = revision;
      if (state.mode === 'floors' && state.filters.section) {
        const available = [...new Set(items.map(item => item.floor).filter(Number.isInteger))].sort((a,b) => b-a);
        if (!available.includes(state.floorView)) state.floorView = available[0] ?? null;
      }
      if (state.selectedId && !items.some(item => item.id === state.selectedId)) clearSelection(notify);
      if (notify) send('scene.apartments.results', { revision, items: sceneItems() });
      if (notify && state.mode === 'floors' && state.floorView !== null) announceFloor();
      highlightIfReady();
    } catch (error) {
      if (error.name !== 'AbortError' && revision === state.revision && state.active) state.error = 'Не удалось загрузить квартиры. Попробуйте ещё раз.';
    } finally { if (revision === state.revision) state.loading = false; }
  }
  async function open(notify = true) {
    if (state.active) return;
    state.active = true; state.mode = 'facade'; state.floorView = null; state.filters = emptyApartmentFilters(); clearSelection();
    if (notify) send('ui.apartments', { mode: 'facade', filters: copy(state.filters) });
    const metadata = loadMetadata().catch(error => { if (error.name !== 'AbortError' && state.active) state.error = 'Не удалось загрузить фильтры. Попробуйте ещё раз.'; });
    await Promise.all([metadata, refresh(notify)]);
  }
  function close(notify = true) {
    if (!state.active) return;
    state.active = false; state.revision++; listController?.abort(); metadataController?.abort(); clearSelection(); state.loading = false;
    if (notify) send('ui.apartments.close');
  }
  function normalizeFilters(patch) {
    const next = copy(state.filters);
    for (const key of ['section']) if (patch[key] === null || validId(patch[key])) next[key] = patch[key];
    for (const key of ['rooms', 'features']) if (Array.isArray(patch[key])) next[key] = [...new Set(patch[key])].filter(value => key === 'rooms' ? Number.isInteger(value) && value >= 0 && value <= 100 : validId(value)).slice(0, 20);
    for (const key of ['floor', 'area', 'price']) {
      for (const side of ['From', 'To']) {
        const value = patch[key + side];
        if (value === null || (typeof value === 'number' && Number.isFinite(value) && (key === 'floor' ? Number.isInteger(value) && value >= -100 && value <= 1000 : value >= 0))) next[key + side] = value;
      }
      if (next[key + 'From'] !== null && next[key + 'To'] !== null && next[key + 'From'] > next[key + 'To']) return null;
    }
    if (typeof patch.number === 'string') next.number = patch.number.trim().slice(0, 64);
    return next;
  }
  async function setFilters(patch, notify = true) {
    if (!patch || typeof patch !== 'object') return;
    const next = normalizeFilters(patch);
    if (!next || JSON.stringify(next) === JSON.stringify(state.filters)) return;
    if (next.section !== state.filters.section) state.floorView = null;
    state.filters = next; clearSelection(notify); await refresh(notify);
  }
  function setMode(mode, notify = true) {
    if (!['facade', 'floors', 'list'].includes(mode) || mode === state.mode) return;
    state.mode = mode;
    if (notify) send('scene.apartments.mode', { mode });
    if (mode === 'floors' && state.filters.section) {
      const available = [...new Set(state.items.map(item => item.floor).filter(Number.isInteger))].sort((a,b) => b-a);
      if (!available.includes(state.floorView)) state.floorView = available[0] ?? null;
      if (notify && state.floorView !== null) announceFloor();
    }
  }
  function announceFloor() {
    const items = sceneItems().filter(item => item.floor === state.floorView && (!state.filters.section || item.sectionId === state.filters.section));
    send('scene.apartments.floor', { revision: state.revision, sectionId: state.filters.section, floor: state.floorView, items });
  }
  function setFloor(floor, notify = true) {
    if (!state.active || state.mode !== 'floors' || !state.filters.section || !Number.isInteger(floor) || !state.items.some(item => item.floor === floor && (!state.filters.section || item.sectionId === state.filters.section))) return false;
    state.floorView = floor;
    if (notify) announceFloor();
    return true;
  }
  async function select({ id, sceneObjectKey } = {}, notify = false) {
    if (!state.active) return false;
    if (id === null) { clearSelection(notify); return true; }
    if (!validId(id) && typeof sceneObjectKey === 'string') id = state.items.find(item => item.sceneObjectKey === sceneObjectKey)?.id;
    if (!validId(id)) return false;
    clearSelection(); state.selectedId = id; state.selectionLoading = true;
    detailController = new AbortController(); const controller = detailController;
    try {
      const { item } = await catalogRequest(`properties/apartment/${id}`, { signal: controller.signal });
      if (controller.signal.aborted || !state.active || state.selectedId !== id) return false;
      if (item?.id !== id || item.type !== 'apartment') throw new Error('Неверная квартира');
      state.selected = item;
      if (notify) send('scene.apartments.select', { id, sceneObjectKey: item.sceneObjectKey || null });
      return true;
    } catch (error) {
      if (error.name !== 'AbortError' && state.selectedId === id) state.selectionError = 'Квартира недоступна или не удалось загрузить данные.';
      return false;
    } finally { if (detailController === controller) state.selectionLoading = false; }
  }
  async function details() {
    if (!state.selectedId) return;
    state.detailsOpen = true;
    // Refresh the same API resource without discarding screenshot or selection.
    const id = state.selectedId; detailController?.abort(); detailController = new AbortController(); const controller = detailController;
    state.selectionLoading = true; state.selectionError = '';
    send('ui.apartment.details', { id });
    try {
      const { item } = await catalogRequest(`properties/apartment/${id}`, { signal: controller.signal });
      if (!controller.signal.aborted && state.active && state.selectedId === id) {
        if (item?.id !== id || item.type !== 'apartment') throw new Error('Неверная квартира');
        state.selected = item;
      }
    } catch (error) { if (error.name !== 'AbortError' && state.selectedId === id) state.selectionError = 'Не удалось обновить карточку квартиры.'; }
    finally { if (detailController === controller) state.selectionLoading = false; }
  }
  function closeDetails() { state.detailsOpen = false; send('ui.apartment.details.close', { id: state.selectedId }); }
  function beginCapture({ captureId } = {}) {
    if (typeof captureId !== 'string' || !captureId || captureId.length > 128) return false;
    clearCapture();
    pendingCapture = { captureId, propertyId: state.selectedId }; state.capturePending = true;
    captureTimer = setTimeout(() => { pendingCapture = null; state.capturePending = false; state.captureError = 'Снимок не получен. Попробуйте ещё раз.'; }, 20000);
    return true;
  }
  function capture() {
    const captureId = `capture-${Date.now()}-${++captureSequence}`;
    beginCapture({ captureId });
    send('scene.screenshot', { captureId, propertyId: state.selectedId });
    return captureId;
  }
  function setScreenshot({ captureId, url, error } = {}) {
    if (!pendingCapture || captureId !== pendingCapture.captureId || state.selectedId !== pendingCapture.propertyId) return false;
    const source = mediaUrl(url, true);
    if (!source && !error) return false;
    clearTimeout(captureTimer); state.capturePending = false; pendingCapture = null;
    if (error) state.captureError = 'Не удалось создать снимок.';
    else {
      const saved = { id: captureId, url: source, propertyId: state.selectedId, createdAt: new Date().toISOString() };
      state.screenshot = saved;
      state.screenshots.unshift(saved);
    }
    return true;
  }
  async function loadScreenshot({ captureId, url } = {}) {
    const source = mediaUrl(url, true);
    if (!source || !pendingCapture || captureId !== pendingCapture.captureId) return false;
    while (pendingCapture?.captureId === captureId && state.capturePending) {
      const loaded = await new Promise(resolve => {
        const image = new Image();
        const finish = success => {
          clearTimeout(timeout);
          image.onload = image.onerror = null;
          resolve(success);
        };
        const timeout = setTimeout(() => finish(false), 1000);
        image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => finish(false);
        image.src = source;
      });
      if (loaded) return setScreenshot({ captureId, url: source });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  }
  function removeScreenshot(id) { state.screenshots = state.screenshots.filter(item => item.id !== id); if (state.screenshot?.id === id) state.screenshot = null; }
  const getMaterials = () => ({ favorites: copy(state.favoriteItems), screenshots: copy(state.screenshots) });
  function setMaterials(materials = {}) {
    if (!materials || typeof materials !== 'object') return false;
    if (Array.isArray(materials.favorites)) {
      state.favoriteItems = materials.favorites.filter(item => item && ['apartment', 'parking', 'storage'].includes(item.type) && validId(item.id)).slice(0, 500).map(copy);
      state.favorites = state.favoriteItems.filter(item => item.type === 'apartment').map(item => item.id);
    }
    if (Array.isArray(materials.screenshots)) {
      state.screenshots = materials.screenshots.filter(item => item && typeof item.id === 'string' && item.id.length <= 128 && mediaUrl(item.url, true)).slice(0, 100).map(item => ({ id: item.id, url: mediaUrl(item.url, true), propertyId: validId(item.propertyId) ? item.propertyId : null, createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString() }));
    }
    return true;
  }
  async function setSessionToken(token) {
    sessionToken = typeof token === 'string' ? token : ''; hasSession.value = !!sessionToken;
    if (!sessionToken) return;
    const currentToken = sessionToken;
    try {
      const data = await catalogRequest('favorites?limit=100', { token: currentToken });
      if (currentToken === sessionToken) {
        state.favoriteItems = Array.isArray(data.items) ? data.items : [];
        state.favorites = state.favoriteItems.filter(item => item.type === 'apartment').map(item => item.id);
      }
    } catch { if (currentToken === sessionToken) state.favoriteError = 'Не удалось загрузить избранное.'; }
  }
  async function toggleFavorite(propertyOrId = state.selected?.id) {
    const type = typeof propertyOrId === 'object' && propertyOrId ? propertyOrId.type : 'apartment';
    const propertyId = typeof propertyOrId === 'object' && propertyOrId ? propertyOrId.id : propertyOrId;
    if (!['apartment', 'parking', 'storage'].includes(type) || !validId(propertyId) || state.favoriteBusy) return;
    const property = state.items.find(item => item.type === type && item.id === propertyId) || state.favoriteItems.find(item => item.type === type && item.id === propertyId) || (state.selected?.type === type && state.selected.id === propertyId ? state.selected : null);
    if (!property) return;
    const id = propertyId, token = sessionToken, exists = state.favoriteItems.some(item => item.type === type && item.id === id);
    if (!token) {
      if (type === 'apartment') state.favorites = exists ? state.favorites.filter(value => value !== id) : [...state.favorites, id];
      state.favoriteItems = exists ? state.favoriteItems.filter(item => item.type !== type || item.id !== id) : [...state.favoriteItems, property];
      return;
    }
    state.favoriteBusy = true; state.favoriteError = '';
    try {
      const result = await catalogRequest(exists ? `favorites/${type}/${id}` : 'favorites', { token, method: exists ? 'DELETE' : 'POST', ...(exists ? {} : { body: { type, id } }) });
      if (token === sessionToken) {
        if (type === 'apartment') state.favorites = exists ? state.favorites.filter(value => value !== id) : [...state.favorites, id];
        state.favoriteItems = exists ? state.favoriteItems.filter(item => item.type !== type || item.id !== id) : [...state.favoriteItems, result?.item || property];
      }
    } catch { if (token === sessionToken) state.favoriteError = 'Не удалось изменить избранное.'; }
    finally { state.favoriteBusy = false; }
  }
  function resetMaterials() {
    clearSelection(); state.screenshots = []; state.favorites = []; state.favoriteItems = []; state.favoriteError = '';
    sessionToken = ''; hasSession.value = false;
  }
  function requestView(kind, options = {}) { if (state.selected) send(`scene.apartment.${kind}`, { id: state.selected.id, sceneObjectKey: state.selected.sceneObjectKey || null, ...options }); }
  async function restore(next = {}) {
    if (next.filters) await setFilters(next.filters, false);
    if (next.mode) setMode(next.mode, false);
    if (Number.isInteger(next.floorView)) setFloor(next.floorView, false);
    if ('selectedId' in next) await select({ id: next.selectedId });
    if (typeof next.detailsOpen === 'boolean' && state.selected) state.detailsOpen = next.detailsOpen;
  }
  onUnmounted(() => { close(false); clearTimeout(captureTimer); });
  return { state, hasSession, snapshot, open, close, refresh, loadMetadata, setFilters, setMode, setFloor, select, details, closeDetails, capture, beginCapture, clearCapture, setScreenshot, loadScreenshot, removeScreenshot, getMaterials, setMaterials, resetMaterials, sceneReady, setSessionToken, toggleFavorite, requestView, restore };
}
