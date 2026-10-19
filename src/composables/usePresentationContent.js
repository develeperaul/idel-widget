import { reactive, watch, onUnmounted } from 'vue';
import { catalogRequest } from '../api/catalog.js';
import { objectChapterIds } from '../data/chapters.js';

const chapters = ['project', ...objectChapterIds];
const validEntry = item => item && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.target === 'string' && typeof item.name === 'string' && Array.isArray(item.description);

export function usePresentationContent(view, { loadChapterIndex = false, enabled = true } = {}) {
  const content = reactive({});
  const chapterIndex = reactive({ items: [], loaded: false, error: '' });
  let chapterRequest = null;
  const controllers = new Map();
  const contentRequests = new Map();

  async function loadChapters() {
    if (!enabled) return;
    if (chapterIndex.loaded) return;
    if (chapterRequest) return chapterRequest;
    const controller = new AbortController();
    controllers.set('chapter-index', controller);
    chapterRequest = (async () => {
      try {
        const data = await catalogRequest('presentation/chapters', { signal: controller.signal });
        if (!Array.isArray(data?.items)) throw new Error('Неверный ответ разделов');
        if (controller.signal.aborted) return;
        chapterIndex.items = data.items;
        chapterIndex.loaded = true;
        chapterIndex.error = '';
      } catch (error) {
        if (!controller.signal.aborted) chapterIndex.error = 'Не удалось загрузить камеры разделов.';
      } finally { controllers.delete('chapter-index'); chapterRequest = null; }
    })();
    return chapterRequest;
  }

  async function loadContent(chapter) {
    if (!enabled) return;
    if (!chapters.includes(chapter) || content[chapter]?.loading || content[chapter]?.items) return;
    const controller = new AbortController();
    controllers.set(chapter, controller);
    content[chapter] = { items: null, loading: true, error: '' };
    try {
      const responses = chapter === 'project'
        ? await Promise.all([catalogRequest('sections', { signal: controller.signal }), catalogRequest('presentation/objects?chapter=project', { signal: controller.signal })])
        : [await catalogRequest(`presentation/objects?chapter=${chapter}`, { signal: controller.signal })];
      if (controller.signal.aborted) return;
      const items = responses.flatMap(data => {
        if (!Array.isArray(data?.items) || !data.items.every(validEntry)) throw new Error('Неверный ответ контента презентации');
        return data.items;
      });
      // Project elements can enrich the same section target with its camera.
      // Duplicates within one endpoint still indicate ambiguous content.
      for (const response of responses) {
        if (new Set(response.items.map(item => item.target)).size !== response.items.length) throw new Error('Повторяющиеся ключи контента');
      }
      const merged = new Map();
      for (const item of items) {
        const previous = merged.get(item.target);
        merged.set(item.target, previous ? { ...previous, ...item, description: item.description.length ? item.description : previous.description, cameraCoordinates: item.cameraCoordinates || previous.cameraCoordinates || null, sceneObjectKey: item.sceneObjectKey || previous.sceneObjectKey || null } : item);
      }
      content[chapter] = { items: [...merged.values()], loading: false, error: '' };
    } catch (error) {
      if (error.name !== 'AbortError' && !controller.signal.aborted) content[chapter] = { items: null, loading: false, error: 'Не удалось загрузить описание. Повторите попытку.' };
    } finally {
      if (controllers.get(chapter) === controller) controllers.delete(chapter);
    }
  }

  async function load(chapter) {
    if (contentRequests.has(chapter)) return contentRequests.get(chapter);
    const request = loadContent(chapter);
    contentRequests.set(chapter, request);
    try { await request; }
    finally { if (contentRequests.get(chapter) === request) contentRequests.delete(chapter); }
  }

  watch(view, chapter => { if (enabled && chapters.includes(chapter)) load(chapter); }, { immediate: true });
  if (loadChapterIndex) loadChapters();
  onUnmounted(() => { for (const controller of controllers.values()) controller.abort(); controllers.clear(); });
  return { content, load, chapterIndex, loadChapters };
}
