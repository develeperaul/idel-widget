<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ApartmentIcon from './ApartmentIcon.vue';
import { catalogRequest, mediaUrl } from '../api/catalog.js';

const emit = defineEmits(['close']);
const useApi = window.IdelConfig?.galleryApi === true;
const items = ref(useApi ? [] : Array.from({ length: 25 }, (_, index) => ({ id: index + 1, title: `Изображение галереи ${index + 1}`, image: `assets/gallery/${String(index + 1).padStart(2, '0')}.jpg` })));
const images = computed(() => items.value.map(item => item.image));
const selected = ref(-1);
const loading = ref(false);
const error = ref('');
async function loadGallery() {
  const complexId = Number(window.IdelConfig?.galleryComplexId);
  if (!Number.isSafeInteger(complexId) || complexId < 1) { error.value = 'Укажите IdelConfig.galleryComplexId для загрузки галереи.'; return; }
  loading.value = true; error.value = '';
  try {
    const data = await catalogRequest(`presentation/gallery?residentialComplex=${complexId}`);
    if (!Array.isArray(data.items)) throw new Error('Некорректный ответ галереи.');
    const next = data.items.map(item => ({ id: item.id, title: item.title, image: mediaUrl(item.image), sort: item.sort }));
    if (next.some(item => !item.image || !Number.isSafeInteger(item.id))) throw new Error('Некорректные изображения галереи.');
    items.value = next.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
    selected.value = -1;
  } catch (cause) { error.value = cause.message || 'Не удалось загрузить галерею.'; }
  finally { loading.value = false; }
}
function step(direction) { if (images.value.length) selected.value = (selected.value + direction + images.value.length) % images.value.length; }
function onKey(event) {
  if (event.key === 'Escape') { if (selected.value >= 0) selected.value = -1; else emit('close'); }
  if (selected.value >= 0 && event.key === 'ArrowLeft') step(-1);
  if (selected.value >= 0 && event.key === 'ArrowRight') step(1);
}
onMounted(() => { document.addEventListener('keydown', onKey); if (useApi) loadGallery(); });
onUnmounted(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <section class="gallery-panel glass" aria-label="Галерея">
    <header class="gallery-header"><div><h1>Галерея</h1><p>{{ useApi ? 'Изображения проекта' : '«Описательный текст»' }}</p></div><button aria-label="Закрыть галерею" @click="emit('close')"><ApartmentIcon name="close" /></button></header>
    <p v-if="loading" role="status">Загрузка галереи…</p>
    <p v-else-if="error" class="apt-error" role="alert">{{ error }} <button @click="loadGallery">Повторить</button></p>
    <p v-else-if="!items.length" role="status">Изображений пока нет.</p>
    <div class="gallery-grid"><button v-for="(item, index) in items" :key="item.id" :aria-label="`Открыть изображение ${index + 1}`" @click="selected = index"><img :src="item.image" :alt="item.title || `Изображение галереи ${index + 1}`" loading="lazy"></button></div>
  </section>
  <Teleport to="body"><div v-if="selected >= 0" class="gallery-viewer" role="dialog" aria-modal="true" aria-label="Просмотр галереи"><button class="gallery-viewer-close" @click="selected = -1">× &nbsp; Закрыть</button><div class="gallery-viewer-stage"><button aria-label="Предыдущее изображение" @click="step(-1)">←</button><img :src="images[selected]" :alt="items[selected]?.title || `Изображение галереи ${selected + 1}`"><button aria-label="Следующее изображение" @click="step(1)">→</button></div><div class="gallery-viewer-thumbs"><button v-for="(item, index) in items" :key="item.id" :aria-pressed="selected === index" :aria-label="`Изображение ${index + 1}`" @click="selected = index"><img :src="item.image" alt=""></button></div></div></Teleport>
</template>
