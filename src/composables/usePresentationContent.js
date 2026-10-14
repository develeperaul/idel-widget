import { reactive, watch, onUnmounted } from 'vue';
import { catalogRequest } from '../api/catalog.js';
import { objectChapterIds } from '../data/chapters.js';

const chapters = ['project', ...objectChapterIds];
const validEntry = item => item && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.target === 'string' && typeof item.name === 'string' && Array.isArray(item.description);

export function usePresentationContent(view) {
  const content = reactive({});
  const controllers = new Map();

  async function load(chapter) {
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
      // Sections precede project objects; duplicate target keys would make selection ambiguous.
      if (new Set(items.map(item => item.target)).size !== items.length) throw new Error('Повторяющиеся ключи контента');
      content[chapter] = { items, loading: false, error: '' };
    } catch (error) {
      if (error.name !== 'AbortError' && !controller.signal.aborted) content[chapter] = { items: null, loading: false, error: 'Не удалось загрузить описание. Повторите попытку.' };
    } finally {
      if (controllers.get(chapter) === controller) controllers.delete(chapter);
    }
  }

  watch(view, chapter => { if (chapters.includes(chapter)) load(chapter); }, { immediate: true });
  onUnmounted(() => { for (const controller of controllers.values()) controller.abort(); controllers.clear(); });
  return { content, load };
}
