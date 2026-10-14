<script setup>
import { computed, ref } from 'vue';
import ApartmentIcon from './ApartmentIcon.vue';
import ApartmentList from './ApartmentList.vue';
import ApartmentFloors from './ApartmentFloors.vue';
const props = defineProps({ state: Object, preview: Boolean, hasSession: Boolean });
const emit = defineEmits(['filter','floor','select','close','closeList','details','favorite','tour','windowView']);
const collapsed = ref(false);
const sections = computed(() => props.state.metadata?.options?.section || []);
const sectionIndex = computed(() => sections.value.findIndex(item => item.value === props.state.filters.section));
function step(direction) { const index = sectionIndex.value < 0 ? 0 : Math.max(0, Math.min(sections.value.length-1, sectionIndex.value+direction)); if (sections.value[index]) emit('filter', {section:sections.value[index].value}); }
</script>
<template>
  <section class="apartment-scene" aria-label="Выбор квартир в сцене">
    <div v-if="preview" class="location-preview"><img class="location-background" src="assets/apartments/facade-background.png" alt="Фасад жилого комплекса"></div>
    <ApartmentList v-if="state.mode === 'list'" :state="state" :has-session="hasSession" @close="emit('closeList')" @select="emit('select', $event)" @details="emit('details', $event)" @favorite="emit('favorite', $event)" @tour="emit('tour', $event)" @window-view="emit('windowView', $event)" />
    <ApartmentFloors v-if="state.mode === 'floors'" :state="state" @filter="emit('filter', $event)" @floor="emit('floor', $event)" />
    <nav v-if="state.mode === 'facade'" class="apt-section-switcher glass" aria-label="Выбор секции"><button class="apt-section-switcher-collapse" :aria-expanded="!collapsed" :aria-label="collapsed ? 'Показать секции' : 'Скрыть секции'" @click="collapsed=!collapsed"><ApartmentIcon name="caret" /></button><template v-if="!collapsed"><span>Секция</span><button aria-label="Предыдущая секция" :disabled="!sections.length || sectionIndex <= 0" @click="step(-1)"><ApartmentIcon name="left" /></button><div class="apt-section-options"><button v-for="option in sections" :key="option.value" :title="option.label" :aria-pressed="state.filters.section === option.value" @click="emit('filter',{section:state.filters.section===option.value?null:option.value})">{{ option.label }}</button></div><button aria-label="Следующая секция" :disabled="!sections.length || sectionIndex === sections.length-1" @click="step(1)"><ApartmentIcon name="right" /></button></template></nav>
    <div v-if="state.mode !== 'list'" class="apt-status-legend glass"><span><ApartmentIcon name="reserved" />Забронировано</span><span><ApartmentIcon name="sold" />Продано</span></div>
    <button class="apt-exit glass" aria-label="Закрыть выбор квартир" @click="emit('close')"><ApartmentIcon name="exit" /></button>
  </section>
</template>
