<script setup>
import { locationCategories } from '../data/location.js';
import PresentationNavigation from './PresentationNavigation.vue';

defineProps({ categories: { type: Array, required: true }, preview: Boolean });
const emit = defineEmits(['toggle-category', 'select-chapter']);
</script>

<template>
  <section class="location-view" aria-label="Локация и инфраструктура">
    <div v-if="preview" class="location-preview">
      <img class="location-background" src="assets/location/location-background.png" alt="Панорама района квартала на Сенной">
    </div>
    <div class="location-controls">
      <div class="location-categories" role="group" aria-label="Категории инфраструктуры">
        <button v-for="category in locationCategories" :key="category.id" class="location-category"
          :class="{ 'location-category--neutral': category.id === 'nursery' }" :data-category="category.id"
          :style="{ '--category-color': category.color }" :aria-pressed="categories.includes(category.id)"
          @click="emit('toggle-category', category.id)">
          <span class="location-icon location-icon--category"><img :src="`assets/location/${category.icon || category.id}.svg`" alt=""></span>
          {{ category.label }}
        </button>
      </div>
      <PresentationNavigation chapter="location" @select-chapter="emit('select-chapter', $event)" />
    </div>
  </section>
</template>
