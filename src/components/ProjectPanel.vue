<script setup>
import PresentationNavigation from './PresentationNavigation.vue';
import { detailChapters } from '../data/chapters.js';

defineProps({ target: { type: String, default: null }, chapter: { type: String, default: 'project' }, chapterData: Object, preview: Boolean, loading: Boolean, error: String });
const emit = defineEmits(['select-target', 'select-chapter', 'retry']);

let drag = null;
let suppressClick = false;

function scrollTargets(event) {
  if (event.ctrlKey) return;
  const row = event.currentTarget;
  if (row.scrollWidth <= row.clientWidth) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1;
  const previous = row.scrollLeft;
  row.scrollLeft += delta * unit;
  if (row.scrollLeft !== previous) event.preventDefault();
}

function startDrag(event) {
  suppressClick = false;
  // Touch uses the browser's native horizontal swipe and momentum.
  if (event.pointerType === 'touch' || event.button !== 0) return;
  const row = event.currentTarget;
  if (row.scrollWidth <= row.clientWidth) return;
  drag = { id: event.pointerId, x: event.clientX, left: row.scrollLeft };
}

function moveDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  if (!(event.buttons & 1)) { endDrag(event); return; }
  const distance = event.clientX - drag.x;
  if (!suppressClick && Math.abs(distance) < 8) return;
  suppressClick = true;
  const row = event.currentTarget;
  if (!row.hasPointerCapture(event.pointerId)) row.setPointerCapture(event.pointerId);
  row.scrollLeft = drag.left - distance;
  event.preventDefault();
}

function endDrag(event) {
  if (drag?.id !== event.pointerId) return;
  drag = null;
  const row = event.currentTarget;
  if (row.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId);
}

function captureClick(event) {
  if (!suppressClick || event.detail === 0) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}
</script>

<template>
  <section class="location-view project-view" :aria-label="detailChapters[chapter].label">
    <div v-if="preview" class="location-preview">
      <img class="location-background" :src="detailChapters[chapter].background" :alt="detailChapters[chapter].label">
    </div>
    <div class="location-controls project-controls">
      <div :key="chapter" class="project-targets" role="group" :aria-label="`Объекты: ${detailChapters[chapter].label}`"
        @wheel="scrollTargets" @pointerdown="startDrag" @pointermove="moveDrag"
        @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag" @click.capture="captureClick">
        <span v-if="loading" class="project-data-status" role="status">Загрузка объектов…</span>
        <span v-else-if="error" class="project-data-status" role="alert">Не удалось загрузить объекты. <button type="button" @click="emit('retry')">Повторить</button></span>
        <span v-else-if="!chapterData?.targets?.length" class="project-data-status" role="status">В этом разделе пока нет объектов.</span>
        <button v-for="item in (chapterData?.targets || [])" :key="item.id" class="project-target" :data-project-target="chapter === 'project' ? item.id : undefined" :data-chapter-target="chapter !== 'project' ? item.id : undefined"
          :aria-pressed="target === item.id" @click="emit('select-target', item.id)">{{ item.label }}</button>
      </div>
      <PresentationNavigation :chapter="chapter" @select-chapter="emit('select-chapter', $event)" />
    </div>
  </section>
</template>
