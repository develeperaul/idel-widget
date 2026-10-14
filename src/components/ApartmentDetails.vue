<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import ApartmentIcon from './ApartmentIcon.vue';
import { apartmentTitle, priceText, numberText, mediaUrl } from '../api/catalog.js';
const props = defineProps({ state: Object, hasSession: Boolean });
const emit = defineEmits(['close','favorite','tour','windowView']);
const root = ref(null), furnished = ref(true);
const item = computed(() => props.state.selected);
const image = computed(() => furnished.value ? item.value?.apartment?.planImage : item.value?.apartment?.planImageUnfurnished);
const rows = computed(() => item.value ? [
  ['Секция', item.value.section?.name], ['Этаж', `${item.value.floor ?? '—'}/${item.value.apartment?.totalFloors ?? '—'}`],
  ['Срок сдачи',item.value.completion?.label], ['Срок передачи',item.value.apartment?.handover?.label], ['Квартира',item.value.number ? `№ ${item.value.number}` : null],
  ['Жилая площадь',item.value.apartment?.livingArea != null ? `${numberText(item.value.apartment.livingArea)} м²` : null], ['Общая площадь', `${numberText(item.value.area)} м²`],
  ['Отделка',item.value.apartment?.finish], ['Жилой квартал',item.value.residentialComplex?.name || 'Идель. Квартал на Сенной'], ['Акция',item.value.apartment?.promotion],
] : []);
let previousFocus;
function keydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); }
  if (event.key === 'Tab') {
    const elements = [...root.value.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}
watch(() => props.state.selectedId, () => { furnished.value = true; });
onMounted(async () => { previousFocus = document.activeElement; await nextTick(); root.value.querySelector('button').focus(); });
onUnmounted(() => { if (previousFocus?.isConnected) previousFocus.focus(); });
</script>
<template>
  <div ref="root" class="apartment-details" role="dialog" aria-modal="true" aria-label="Подробная карточка квартиры" @keydown="keydown">
    <button class="apt-details-close" @click="emit('close')"><ApartmentIcon name="close" />Закрыть</button>
    <div class="apt-details-body glass">
      <section class="apt-details-info">
        <p v-if="state.selectionLoading" role="status">Обновление данных…</p><p v-if="state.selectionError" class="apt-error" role="alert">{{ state.selectionError }}</p>
        <template v-if="item"><div class="apt-detail-tags"><span v-for="feature in item.features" :key="feature.id">{{ feature.name }}</span></div>
          <h1>{{ apartmentTitle(item) }}</h1><p class="apt-details-price">{{ priceText(item.price) }}</p>
          <p v-if="item.apartment?.mortgageFrom != null" class="apt-muted">В ипотеку — от {{ numberText(item.apartment.mortgageFrom) }} ₽/мес.</p>
          <dl><div v-for="[label,value] in rows" :key="label"><dt>{{ label }}</dt><dd>{{ value ?? 'Уточняется' }}</dd></div></dl>
          <div class="apt-details-actions"><div><button @click="emit('tour')"><ApartmentIcon name="tour" />3D-тур</button><button @click="emit('windowView')"><ApartmentIcon name="window" />Вид из окна</button></div><button :disabled="state.favoriteBusy" :aria-pressed="state.favorites.includes(item.id)" @click="emit('favorite')"><ApartmentIcon name="favorite" />{{ state.favorites.includes(item.id) ? 'Удалить из избранного' : 'Добавить в избранное' }}</button><p v-if="state.favoriteError" role="alert">{{ state.favoriteError }}</p></div>
        </template>
      </section>
      <section class="apt-details-plan" aria-label="Планировка квартиры">
        <img v-if="mediaUrl(image)" class="apt-details-plan-image" :src="mediaUrl(image)" alt="Планировка квартиры"><p v-else>Планировка пока недоступна</p>
        <span class="apt-plan-compass" aria-hidden="true"><img src="assets/apartments/plan-compass.svg" alt=""></span>
        <div class="apt-furniture"><button :aria-pressed="furnished" @click="furnished=true">С мебелью</button><button :aria-pressed="!furnished" :disabled="!mediaUrl(item?.apartment?.planImageUnfurnished)" title="Планировка без мебели" @click="furnished=false">Без мебели</button></div>
      </section>
    </div>
  </div>
</template>
