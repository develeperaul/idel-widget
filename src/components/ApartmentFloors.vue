<script setup>
import { computed, ref } from 'vue';

const props = defineProps({ state: Object });
const emit = defineEmits(['filter', 'floor']);
const collapsed = ref(false);
const sections = computed(() => props.state.metadata?.options?.section || []);
const floors = computed(() => [...new Set(props.state.items
  .filter(item => !props.state.filters.section || item.section?.id === props.state.filters.section)
  .map(item => item.floor).filter(Number.isInteger))].sort((a, b) => b - a));
const current = computed(() => floors.value.includes(props.state.floorView) ? props.state.floorView : floors.value[0]);
const floorItems = floor => props.state.items.filter(item => item.floor === floor);
function step(direction) {
  const index = floors.value.indexOf(current.value);
  const next = floors.value[index + direction];
  if (Number.isInteger(next)) emit('floor', next);
}
</script>

<template>
  <div v-if="!state.filters.section" class="apt-floor-sections glass" aria-label="Выбор секции для просмотра этажей">
    <p>Выберите секцию, чтобы посмотреть квартиры на этаже</p>
    <div><button v-for="section in sections" :key="section.value" @click="emit('filter', { section: section.value })">{{ section.label }}</button></div>
  </div>
  <nav v-else class="apt-floor-nav glass" :class="{ 'apt-floor-nav-collapsed': collapsed }" aria-label="Выбор этажа">
    <div class="apt-floor-heading"><span>Этаж</span><button :aria-label="collapsed ? 'Показать этажи' : 'Скрыть этажи'" :aria-expanded="!collapsed" @click="collapsed = !collapsed">{{ collapsed ? '›' : '‹' }}</button></div>
    <template v-if="!collapsed">
      <button class="apt-floor-arrow" aria-label="Этаж выше" :disabled="!floors.length || current === floors[0]" @click="step(-1)"><img src="assets/apartments/floor-up.svg" alt=""></button>
      <div class="apt-floor-options">
        <button v-for="floor in floors" :key="floor" :aria-label="`Этаж ${floor}`" :aria-pressed="current === floor" @click="emit('floor', floor)"><span>{{ floor }}</span><small>{{ floorItems(floor).length }}</small></button>
      </div>
      <button class="apt-floor-arrow" aria-label="Этаж ниже" :disabled="!floors.length || current === floors[floors.length - 1]" @click="step(1)"><img src="assets/apartments/floor-down.svg" alt=""></button>
    </template>
  </nav>
</template>
