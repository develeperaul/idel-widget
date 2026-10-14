<script setup>
import { presentationChapters } from '../data/location.js';
import { objectChapterIds } from '../data/chapters.js';

const props = defineProps({ chapter: { type: String, required: true } });
const emit = defineEmits(['select-chapter']);
function icon(chapter) {
  if (objectChapterIds.includes(props.chapter)) return `assets/chapters/${props.chapter}/${chapter.icon}.svg`;
  const variant = props.chapter === 'project' && ['location', 'project'].includes(chapter.id) ? 'project' : 'location';
  return `assets/${variant}/${chapter.icon}.svg`;
}
</script>

<template>
  <nav class="location-chapters glass" :class="{ 'project-chapters': chapter !== 'location' }" aria-label="Разделы презентации">
    <span class="location-route" aria-hidden="true"><img :src="`assets/${objectChapterIds.includes(chapter) ? `chapters/${chapter}` : chapter === 'project' ? 'project' : 'location'}/route-line.svg`" alt=""></span>
    <button v-for="item in presentationChapters" :key="item.id" class="location-chapter" :data-chapter="item.id"
      :aria-current="item.id === chapter ? 'page' : undefined" :disabled="!item.available" :title="item.label"
      @click="emit('select-chapter', item.id)">
      <span class="location-chapter-icon"><span class="location-icon"><img :src="icon(item)" alt=""></span></span>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
