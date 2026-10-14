<script setup>
import { computed, ref, watch } from 'vue';
import ApartmentIcon from './ApartmentIcon.vue';
import { apartmentTitle, mediaUrl, numberText, priceText } from '../api/catalog.js';

const props = defineProps({ state: Object, hasSession: Boolean });
const emit = defineEmits(['close', 'select', 'details', 'favorite', 'tour', 'windowView']);
const page = ref(1);
const pageSize = 10;
const pageCount = computed(() => Math.max(1, Math.ceil(props.state.items.length / pageSize)));
const cards = computed(() => props.state.items.slice((page.value - 1) * pageSize, page.value * pageSize));
const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 3, pageCount.value - 6));
  return Array.from({ length: Math.min(7, pageCount.value) }, (_, index) => start + index);
});
watch(() => [props.state.revision, props.state.mode], () => { page.value = 1; });
function goToPage(next) {
  page.value = Math.max(1, Math.min(pageCount.value, next));
}
</script>

<template>
  <section class="apt-list glass" aria-label="Список квартир">
    <header class="apt-list-header">
      <div>
        <nav class="apt-list-tabs" aria-label="Тип недвижимости">
          <span aria-current="page">Квартиры</span><span class="apt-list-tab-disabled" title="Каталог машиномест пока не подключён">Машино-места</span><span class="apt-list-tab-disabled" title="Каталог кладовых пока не подключён">Кладовые</span>
        </nav>
        <p class="apt-list-count" role="status">{{ state.loading ? 'Загрузка квартир…' : `Найдено ${state.items.length} квартир` }}</p>
      </div>
      <button class="apt-list-close" aria-label="Закрыть список квартир" @click="emit('close')"><ApartmentIcon name="close" /></button>
    </header>

    <p v-if="state.error" class="apt-error" role="alert">{{ state.error }}</p>
    <div v-if="!state.loading && !cards.length" class="apt-list-empty">По выбранным параметрам квартир нет.</div>
    <div v-else class="apt-list-grid">
      <article v-for="item in cards" :key="item.id" class="apt-list-card" :class="{ 'apt-list-card-selected': state.selectedId === item.id, 'apt-list-card-unavailable': item.status !== 'available' }" :data-apartment-id="item.id" @click="item.status === 'available' && emit('select', { id: item.id })">
        <div class="apt-list-card-header">
          <div class="apt-list-card-heading">
            <h2>{{ item.residentialComplex?.name || '«Идель. Квартал на Сенной»' }}</h2>
            <p>{{ item.section?.name || 'Секция —' }} <span>·</span> Этаж {{ item.floor ?? '—' }} <span>·</span> Кв. №{{ item.number ?? '—' }}</p>
          </div>
          <button class="apt-list-favorite" :disabled="state.favoriteBusy" :aria-label="state.favorites.includes(item.id) ? 'Убрать квартиру из избранного' : 'Добавить квартиру в избранное'" :aria-pressed="state.favorites.includes(item.id)" title="Избранное" @click.stop="emit('favorite', { id: item.id })"><ApartmentIcon name="favorite" /></button>
        </div>
        <div class="apt-list-plan">
          <img v-if="mediaUrl(item.apartment?.planImage)" :src="mediaUrl(item.apartment.planImage)" :alt="`Планировка квартиры №${item.number ?? item.id}`" loading="lazy">
          <span v-else>Планировка пока недоступна</span>
        </div>
        <div class="apt-list-card-body">
          <h3><span :class="`apt-room-dot room-${Math.min(item.apartment?.rooms || 0, 4)}`"></span>{{ apartmentTitle(item) }}</h3>
          <p class="apt-list-price">{{ priceText(item.price) }}</p>
          <p class="apt-list-meta">В ипотеку — <strong>{{ item.apartment?.mortgageFrom != null ? `от ${numberText(item.apartment.mortgageFrom)} ₽/мес.` : 'уточняется' }}</strong></p>
          <p class="apt-list-meta">Срок сдачи — <strong>{{ item.completion?.label || 'уточняется' }}</strong></p>
        </div>
        <div class="apt-list-card-actions">
          <button data-action="ui.apartment.details" @click.stop="emit('details', { id: item.id })">Подробнее</button>
          <button :aria-label="`3D-тур квартиры №${item.number ?? item.id}`" title="3D-тур" @click.stop="emit('tour', { id: item.id })"><ApartmentIcon name="tour" /></button>
          <button :aria-label="`Вид из окна квартиры №${item.number ?? item.id}`" title="Вид из окна" @click.stop="emit('windowView', { id: item.id })"><ApartmentIcon name="window" /></button>
        </div>
        <div v-if="item.status === 'reserved' || item.status === 'sold'" class="apt-list-status-overlay"><span><ApartmentIcon :name="item.status" /></span><strong>Квартира<br>{{ item.status === 'reserved' ? 'забронирована' : 'продана' }}</strong></div>
      </article>
    </div>

    <nav v-if="!state.loading && state.items.length" class="apt-list-pages" aria-label="Страницы квартир">
      <button aria-label="Первая страница" :disabled="page === 1" @click="goToPage(1)">⇤</button>
      <button aria-label="Предыдущая страница" :disabled="page === 1" @click="goToPage(page - 1)"><ApartmentIcon name="left" /></button>
      <button v-for="number in pageNumbers" :key="number" :aria-label="`Страница ${number}`" :aria-current="page === number ? 'page' : undefined" @click="goToPage(number)">{{ number }}</button>
      <button aria-label="Следующая страница" :disabled="page === pageCount" @click="goToPage(page + 1)"><ApartmentIcon name="right" /></button>
      <button aria-label="Последняя страница" :disabled="page === pageCount" @click="goToPage(pageCount)">⇥</button>
    </nav>
  </section>
</template>
