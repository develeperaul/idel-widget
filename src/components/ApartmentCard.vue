<script setup>
import ApartmentIcon from './ApartmentIcon.vue';
import { apartmentTitle, priceText, mediaUrl, numberText } from '../api/catalog.js';
defineProps({ state: Object, hasSession: Boolean });
const emit = defineEmits(['details', 'favorite', 'tour', 'windowView', 'close', 'closeCapture', 'retry']);
</script>
<template>
  <aside class="apartment-card-stack" aria-label="Выбранная квартира" aria-live="polite">
    <section v-if="state.selectedId" class="apartment-card glass">
      <div class="apt-card-top"><div><h2>{{ state.selected?.residentialComplex?.name || 'Идель. Квартал на Сенной' }}</h2><p class="apt-muted" v-if="state.selected">{{ state.selected.section?.name || 'Секция —' }} · Этаж {{ state.selected.floor ?? '—' }} · № {{ state.selected.number ?? '—' }}</p></div><button aria-label="Закрыть выбранную квартиру" @click="emit('close')"><ApartmentIcon name="close" /></button></div>
      <p v-if="state.selectionLoading" role="status">Загрузка квартиры…</p><p v-if="state.selectionError" class="apt-error" role="alert">{{ state.selectionError }} <button @click="emit('retry')">Повторить</button></p>
      <template v-if="state.selected">
        <img v-if="mediaUrl(state.selected.apartment?.planImage)" class="apt-card-plan" :src="mediaUrl(state.selected.apartment.planImage)" alt="Планировка выбранной квартиры">
        <div v-else class="apt-plan-placeholder">Планировка пока недоступна</div>
        <h3><span :class="`apt-room-dot room-${Math.min(state.selected.apartment?.rooms || 0,4)}`"></span>{{ apartmentTitle(state.selected) }}</h3>
        <p class="apt-card-price">{{ priceText(state.selected.price) }}</p>
        <p v-if="state.selected.apartment?.mortgageFrom != null" class="apt-muted">В ипотеку — от {{ numberText(state.selected.apartment?.mortgageFrom) }} ₽/мес.</p>
        <p class="apt-muted">Срок сдачи — {{ state.selected.completion?.label || 'Уточняется' }}</p>
        <div class="apt-card-actions"><button data-action="ui.apartment.details" @click="emit('details')">Подробнее</button><button title="3D-тур" aria-label="3D-тур" @click="emit('tour')"><ApartmentIcon name="tour" /></button><button title="Вид из окна" aria-label="Вид из окна" @click="emit('windowView')"><ApartmentIcon name="window" /></button><button :disabled="state.favoriteBusy" title="Избранное" aria-label="Избранное квартиры" :aria-pressed="state.favorites.includes(state.selected.id)" @click="emit('favorite')"><ApartmentIcon name="favorite" /></button></div>
        <p v-if="state.favoriteError" class="apt-error" role="alert">{{ state.favoriteError }}</p>
      </template>
    </section>
    <section v-if="state.screenshot || state.capturePending || state.captureError" class="apt-capture glass" aria-label="Снимок экрана">
      <p class="apt-muted" role="status">{{ state.capturePending ? 'Создание снимка…' : state.captureError || 'Скриншот сохранён' }}</p>
      <img v-if="state.screenshot" :src="state.screenshot.url" alt="Снимок сцены, полученный из Unreal">
      <button @click="emit('closeCapture')">Закрыть <ApartmentIcon name="close" /></button>
    </section>
  </aside>
</template>
