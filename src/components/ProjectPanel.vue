<script setup>
import PresentationNavigation from './PresentationNavigation.vue';
import { detailChapters } from '../data/chapters.js';

defineProps({ target: { type: String, required: true }, chapter: { type: String, default: 'project' }, chapterData: Object, preview: Boolean });
const emit = defineEmits(['select-target', 'select-chapter']);
</script>

<template>
  <section class="location-view project-view" :aria-label="detailChapters[chapter].label">
    <div v-if="preview" class="location-preview">
      <img class="location-background" :src="detailChapters[chapter].background" :alt="detailChapters[chapter].label">
    </div>
    <div class="location-controls project-controls">
      <div :key="chapter" class="project-targets" role="group" :aria-label="`Объекты: ${detailChapters[chapter].label}`">
        <button v-for="item in (chapterData || detailChapters[chapter]).targets" :key="item.id" class="project-target" :data-project-target="chapter === 'project' ? item.id : undefined" :data-chapter-target="chapter !== 'project' ? item.id : undefined"
          :aria-pressed="target === item.id" @click="emit('select-target', item.id)">{{ item.label }}</button>
      </div>
      <PresentationNavigation :chapter="chapter" @select-chapter="emit('select-chapter', $event)" />
    </div>
  </section>
</template>
