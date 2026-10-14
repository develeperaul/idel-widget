<script setup>
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue';
import ApartmentIcon from './ApartmentIcon.vue';
import VirtualKeyboard from './VirtualKeyboard.vue';
import { apartmentTitle, mediaUrl, priceText } from '../api/catalog.js';

const props = defineProps({ state: { type: Object, required: true } });
const emit = defineEmits(['close', 'favorite', 'removeScreenshot', 'openApartment']);
const channel = ref('');
const email = ref('');
const emailInput = ref(null);
const consent = ref(false);
const selectedScreenshot = ref(null);
const types = [
  { id: 'apartment', title: 'Квартиры' },
  { id: 'storage', title: 'Кладовые' },
  { id: 'parking', title: 'Машино-места' },
];
const groups = computed(() => types.map(type => ({ ...type, items: props.state.favoriteItems.filter(item => item.type === type.id) })));
const shotCount = computed(() => props.state.screenshots.length);
const savedCount = computed(() => props.state.favoriteItems.length);
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));
function screenshotName(shot) {
  const apartment = props.state.favoriteItems.find(item => item.type === 'apartment' && item.id === shot.propertyId);
  return apartment ? `Квартира №${apartment.number ?? apartment.id}` : 'Снимок сцены';
}
function openChannel(next) { channel.value = next; email.value = ''; consent.value = false; }
function closeDialog() { channel.value = ''; selectedScreenshot.value = null; }
function editEmail(key) {
  const field = emailInput.value;
  let start = field?.selectionStart ?? email.value.length;
  let end = field?.selectionEnd ?? start;
  if (key === 'backspace' && start === end) start = Math.max(0, start - 1);
  const inserted = key === 'backspace' ? '' : key;
  email.value = email.value.slice(0, start) + inserted + email.value.slice(end);
  nextTick(() => { field?.focus(); field?.setSelectionRange(start + inserted.length, start + inserted.length); });
}
function onKey(event) { if (event.key === 'Escape' && (channel.value || selectedScreenshot.value)) closeDialog(); }
onMounted(() => document.addEventListener('keydown', onKey));
onUnmounted(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <section class="saved-panel glass" aria-label="Сохранённое">
    <header class="saved-header">
      <div><h1>Сохранённое</h1><p>Снимки доступны до конца сессии</p></div>
      <button class="saved-close" aria-label="Закрыть сохранённое" @click="emit('close')"><ApartmentIcon name="close" /></button>
    </header>
    <div class="saved-scroll">
        <section v-for="group in groups" :key="group.id" class="saved-group" :aria-label="group.title">
          <h2>{{ group.title }} <span>{{ group.items.length }}</span></h2>
          <div v-if="group.items.length" class="saved-grid">
            <article v-for="item in group.items" :key="`${group.id}-${item.id}`" class="saved-card">
              <div class="saved-card-head"><div><h3>{{ item.residentialComplex?.name || '«Идель. Квартал на Сенной»' }}</h3><p>{{ item.section?.name || 'Секция —' }} · Этаж {{ item.floor ?? '—' }} · №{{ item.number ?? item.id }}</p></div><button :aria-label="`Удалить из избранного №${item.number ?? item.id}`" :disabled="state.favoriteBusy" @click="emit('favorite', item)"><ApartmentIcon name="favorite" /></button></div>
              <div class="saved-card-image"><img v-if="mediaUrl(item.apartment?.planImage)" :src="mediaUrl(item.apartment.planImage)" :alt="`Планировка №${item.number ?? item.id}`"><span v-else>Планировка пока недоступна</span></div>
              <p class="saved-card-title">{{ group.id === 'apartment' ? apartmentTitle(item) : group.title.slice(0, -1) }}</p>
              <p class="saved-card-price">{{ priceText(item.price) }}</p>
              <button v-if="group.id === 'apartment'" class="saved-card-details" @click="emit('openApartment', item.id)">Подробнее</button>
            </article>
          </div>
          <p v-else class="saved-empty">Пока ничего не добавлено</p>
        </section>
      <section class="saved-group" aria-label="Скриншоты">
        <h2>Скриншоты <span>{{ shotCount }}</span></h2>
        <div v-if="shotCount" class="saved-grid">
          <article v-for="shot in state.screenshots" :key="shot.id" class="saved-shot">
            <button class="saved-shot-preview" :aria-label="`Открыть: ${screenshotName(shot)}`" @click="selectedScreenshot = shot"><img :src="shot.url" :alt="screenshotName(shot)"></button>
            <div class="saved-shot-footer"><div><strong>{{ screenshotName(shot) }}</strong><small>{{ new Date(shot.createdAt).toLocaleString('ru-RU') }}</small></div><button :aria-label="`Удалить снимок: ${screenshotName(shot)}`" @click="emit('removeScreenshot', shot.id)"><ApartmentIcon name="close" /></button></div>
          </article>
        </div>
        <p v-else class="saved-empty">Снимков пока нет. Нажмите кнопку камеры во время презентации.</p>
      </section>
    </div>
    <footer class="saved-footer"><span>{{ savedCount }} объектов · {{ shotCount }} снимков</span><div><button @click="openChannel('email')">Отправить на почту</button><button @click="openChannel('telegram')">Telegram</button><button @click="openChannel('max')">MAX</button></div></footer>
  </section>
  <Teleport to="body">
    <div v-if="selectedScreenshot" class="saved-backdrop" @click.self="closeDialog"><section class="saved-image-dialog glass" role="dialog" aria-modal="true" aria-label="Снимок сцены"><button aria-label="Закрыть снимок" @click="closeDialog"><ApartmentIcon name="close" /></button><img :src="selectedScreenshot.url" :alt="screenshotName(selectedScreenshot)"></section></div>
    <div v-if="channel" class="saved-backdrop" @click.self="closeDialog"><section class="saved-share-dialog glass" role="dialog" aria-modal="true" :aria-label="channel === 'email' ? 'Отправить на почту' : `Отправить через ${channel}`"><button class="saved-share-close" aria-label="Закрыть" @click="closeDialog"><ApartmentIcon name="close" /></button><h2>{{ channel === 'email' ? 'Отправить по e-mail' : channel === 'telegram' ? 'Отправка через Telegram' : 'Отправка через MAX' }}</h2><p v-if="channel === 'email'">Укажите адрес электронной почты, чтобы получить выбранные квартиры и сохранённые скриншоты.</p><template v-if="channel === 'email'"><label class="saved-email-label">Электронная почта<input ref="emailInput" v-model.trim="email" type="text" inputmode="email" autocomplete="email" placeholder="E-mail"></label><VirtualKeyboard keyboard-id="share-keyboard" @key="editEmail" /></template><template v-else><div class="saved-share-steps"><span><b>1</b>Откройте QR-код</span><span><b>2</b>Откройте бота {{ channel === 'telegram' ? 'Telegram' : 'MAX' }}</span><span><b>3</b>Нажмите «Старт»</span></div><div class="saved-qr-placeholder">QR появится после подключения бота</div></template><p class="saved-share-status" role="status">{{ channel === 'email' ? 'Отправка пока недоступна: почтовый сервис не подключён.' : `Отправка через ${channel === 'telegram' ? 'Telegram' : 'MAX'} пока недоступна: бот не подключён.` }}</p><button v-if="channel === 'email'" class="saved-share-submit" disabled :title="!emailValid || !consent ? 'Введите адрес и подтвердите согласие' : 'Ожидается подключение сервиса'">Отправить</button><div class="saved-share-channels"><button v-if="channel !== 'email'" @click="openChannel('email')">Отправить по e-mail</button><button v-if="channel !== 'telegram'" @click="openChannel('telegram')">Отправить через Telegram</button><button v-if="channel !== 'max'" @click="openChannel('max')">Отправить через MAX</button></div><label v-if="channel === 'email'" class="saved-consent"><input v-model="consent" type="checkbox">Я соглашаюсь на обработку персональных данных</label></section></div>
  </Teleport>
</template>
