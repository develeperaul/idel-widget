<script setup>
defineProps({ target: { type: Object, required: true }, loading: Boolean, error: String });
const emit = defineEmits(['retry']);
</script>

<template>
  <section class="project-description glass" aria-labelledby="project-description-title" aria-live="polite" aria-atomic="true">
    <header class="project-description-heading">
      <p v-if="target.room" class="project-description-room">{{ target.room }}</p>
      <h2 id="project-description-title">{{ target.label }}</h2>
    </header>
    <div class="project-description-text">
      <p v-if="loading" role="status">Загрузка описания…</p>
      <p v-else-if="error" role="alert">{{ error }} <button @click="emit('retry')">Повторить</button></p>
      <p v-else-if="!target.description.length">Описание пока не добавлено.</p>
      <p v-for="(paragraph, index) in target.description" :key="index">{{ paragraph }}</p>
    </div>
  </section>
</template>
