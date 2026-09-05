<script setup>
import { ref } from 'vue';
defineEmits(['start']);
const button = ref(null);
defineExpose({ focus: () => button.value.focus() });
</script>
<template>
  <section id="welcome" aria-label="Начало демонстрации" @click="$emit('start')">
    <img class="welcome-logo" src="assets/welcome.svg" alt="Идель">
    <button id="start" ref="button" class="primary"><img src="assets/play.svg" alt="">Начать демонстрацию</button>
    <p class="touch-hint"><img src="assets/tap.svg" alt="">Коснитесь экрана для начала</p>
  </section>
</template>
