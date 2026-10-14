<script setup>
import ApartmentCard from './ApartmentCard.vue';

defineProps({ state: Object, viewIndex: Number, preview: Boolean, hasSession: Boolean });
const emit = defineEmits(['back', 'change', 'details', 'favorite', 'tour', 'pan', 'resetNorth']);
</script>

<template>
  <section class="apt-window-view" :class="{ 'apt-window-preview': preview }" :data-window-view="viewIndex" aria-label="Вид из окна">
    <img v-if="preview" class="apt-window-background" :src="`assets/apartments/window-view-${viewIndex === 1 ? 1 : 2}.png`" alt="">
    <button class="apt-window-back" data-action="scene.apartment.window.close" @click="emit('back')"><span aria-hidden="true">←</span> Назад</button>
    <button class="apt-window-compass" aria-label="На север" title="На север" @click="emit('resetNorth')"><img src="assets/compass.svg" alt=""></button>
    <ApartmentCard :state="state" :has-session="hasSession" @details="emit('details')" @favorite="emit('favorite')" @tour="emit('tour')" @window-view="emit('change', viewIndex)" @close="emit('back')" />
    <nav class="apt-window-pages glass" aria-label="Ракурс из окна">
      <span>Вид</span>
      <button :disabled="viewIndex === 1" aria-label="Предыдущий вид" @click="emit('change', viewIndex - 1)">←</button>
      <button v-for="index in 3" :key="index" :aria-current="viewIndex === index ? 'page' : undefined" :aria-label="`Вид ${index}`" @click="emit('change', index)">{{ index }}</button>
      <button :disabled="viewIndex === 3" aria-label="Следующий вид" @click="emit('change', viewIndex + 1)">→</button>
    </nav>
    <div class="apt-window-pan" role="group" aria-label="Переместить взгляд">
      <button v-for="direction in ['up','right','down','left']" :key="direction" :class="`apt-pan-${direction}`" :aria-label="({up:'Вверх',right:'Вправо',down:'Вниз',left:'Влево'})[direction]" @click="emit('pan', direction)"><img src="assets/apartments/left.svg" alt=""></button>
    </div>
  </section>
</template>
