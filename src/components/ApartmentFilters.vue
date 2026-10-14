<script setup>
import { computed, ref, watch } from 'vue';
import ApartmentIcon from './ApartmentIcon.vue';
import { emptyApartmentFilters, numberText } from '../api/catalog.js';
const props = defineProps({ state: Object });
const emit = defineEmits(['filter', 'mode', 'retry']);
const numberOpen = ref(false);
const options = computed(() => props.state.metadata?.options || {});
const bounds = computed(() => props.state.metadata?.bounds || {});
function toggle(key, value) { const list = props.state.filters[key]; emit('filter', { [key]: list.includes(value) ? list.filter(item => item !== value) : [...list, value] }); }
const rangeDraft = ref({});
watch(() => props.state.filters, () => { rangeDraft.value = {}; });
const rangeCurrent = (key, side) => rangeDraft.value[key + side] ?? props.state.filters[key + side];
function slideRange(key, side, value, commit = false) {
  const opposite = side === 'From' ? 'To' : 'From';
  const other = rangeCurrent(key, opposite) ?? bounds.value[key][side === 'From' ? 'max' : 'min'];
  const next = side === 'From' ? Math.min(Number(value), other) : Math.max(Number(value), other);
  rangeDraft.value = { ...rangeDraft.value, [key + side]: next };
  if (commit) emit('filter', { ...rangeDraft.value });
}
function rangeChange(key, side, value) {
  const next = value === '' ? null : Number(value) * (key === 'price' ? 1000000 : 1);
  const patch = { [key + side]: next };
  const opposite = side === 'From' ? 'To' : 'From', other = props.state.filters[key + opposite];
  if (next !== null && other !== null && (side === 'From' ? next > other : next < other)) patch[key + opposite] = next;
  emit('filter', patch);
}
const rangeValue = (key, side) => rangeCurrent(key, side) == null ? '' : rangeCurrent(key, side) / (key === 'price' ? 1000000 : 1);
const rangeBound = (key, side) => bounds.value[key]?.[side] === undefined ? '' : numberText(bounds.value[key][side] / (key === 'price' ? 1000000 : 1));
const roomLabel = value => value === 0 ? 'С' : `${value}К`;
</script>
<template>
  <section class="apartment-filters glass" aria-label="Фильтры квартир">
    <div class="apt-filter-scroll">
      <p v-if="state.error" class="apt-error" role="alert">{{ state.error }} <button @click="emit('retry')">Повторить</button></p>
      <p v-if="!state.metadata && state.loading" role="status">Загрузка фильтров…</p>
      <fieldset><legend>Секция</legend><div class="apt-options apt-sections">
        <button v-for="option in options.section || []" :key="option.value" :aria-pressed="state.filters.section === option.value" :title="option.label" @click="emit('filter', {section: state.filters.section === option.value ? null : option.value})">{{ option.label.replace(/^Секция\s*/i, '') }}</button>
      </div></fieldset>
      <fieldset><legend>Комнатность</legend><div class="apt-options apt-rooms">
        <button v-for="option in options.rooms || []" :key="option.value" :data-rooms="option.value" :aria-label="option.value === 0 ? 'Студия' : `${option.value} комнат`" :aria-pressed="state.filters.rooms.includes(option.value)" @click="toggle('rooms', option.value)"><span :class="`apt-room-dot room-${Math.min(option.value, 4)}`"></span>{{ roomLabel(option.value) }}</button>
      </div></fieldset>
      <fieldset v-for="[key,label] in [['floor','Этаж'],['area','Площадь, м²'],['price','Стоимость, млн ₽']]" :key="key" class="apt-range" :aria-label="label">
        <div class="apt-range-header"><span class="apt-range-label">{{ label }}</span><div class="apt-range-values"><input type="number" :aria-label="`${label}: от`" :step="key === 'floor' ? 1 : .01" :value="rangeValue(key, 'From')" :placeholder="rangeBound(key, 'min')" :style="{'--value-width': String(rangeValue(key, 'From') === '' ? rangeBound(key, 'min') : rangeValue(key, 'From')).length + 'ch'}" @change="rangeChange(key,'From',$event.target.value)"><span>—</span><input type="number" :aria-label="`${label}: до`" :step="key === 'floor' ? 1 : .01" :value="rangeValue(key, 'To')" :placeholder="rangeBound(key, 'max')" :style="{'--value-width': String(rangeValue(key, 'To') === '' ? rangeBound(key, 'max') : rangeValue(key, 'To')).length + 'ch'}" @change="rangeChange(key,'To',$event.target.value)"></div></div>
        <div v-if="bounds[key]?.min !== null && bounds[key]?.max > bounds[key]?.min" class="apt-range-sliders" :class="{'apt-range-at-end': rangeCurrent(key,'From') === bounds[key].max}">
          <input type="range" :aria-label="`${label}: нижняя граница`" :min="bounds[key].min" :max="bounds[key].max" :step="key === 'floor' ? 1 : key === 'price' ? 1 : .1" :value="rangeCurrent(key,'From') ?? bounds[key].min" @input="slideRange(key,'From',$event.target.value)" @change="slideRange(key,'From',$event.target.value,true)">
          <input type="range" :aria-label="`${label}: верхняя граница`" :min="bounds[key].min" :max="bounds[key].max" :step="key === 'floor' ? 1 : key === 'price' ? 1 : .1" :value="rangeCurrent(key,'To') ?? bounds[key].max" @input="slideRange(key,'To',$event.target.value)" @change="slideRange(key,'To',$event.target.value,true)">
        </div>
      </fieldset>
      <fieldset><legend>Особенности</legend><div class="apt-features"><button v-for="option in options.features || []" :key="option.value" :aria-pressed="state.filters.features.includes(option.value)" @click="toggle('features', option.value)">{{ option.label }}</button></div><p v-if="state.metadata && !options.features?.length" class="apt-muted">Нет доступных особенностей</p></fieldset>
    </div>
    <div class="apt-filter-footer">
      <div class="apt-modes" role="group" aria-label="Способ выбора квартиры"><button v-for="[mode,label,icon] in [['facade','Фасад','facade'],['floors','Этажи','floors'],['list','Списком','list']]" :key="mode" :data-apartment-mode="mode" :aria-pressed="state.mode === mode" @click="emit('mode',mode)"><ApartmentIcon :name="icon" />{{ label }}</button></div>
      <div class="apt-filter-actions"><button @click="emit('filter',emptyApartmentFilters())"><ApartmentIcon name="reset" />Сбросить</button><button :aria-expanded="numberOpen" @click="numberOpen = !numberOpen"><ApartmentIcon name="search" />По номеру</button></div>
      <form v-if="numberOpen" class="apt-number-search" @submit.prevent="emit('filter', {number:$event.target.elements.number.value})"><input name="number" aria-label="Номер квартиры" :value="state.filters.number" maxlength="64" placeholder="Номер квартиры"><button type="submit">Найти</button></form>
      <p class="apt-muted" role="status">{{ state.loading ? 'Загрузка квартир…' : `Найдено: ${state.items.length}` }}</p>
    </div>
  </section>
</template>
