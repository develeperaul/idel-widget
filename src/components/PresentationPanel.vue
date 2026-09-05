<script setup>
import { reactive, computed, ref, watch, onUnmounted } from 'vue';
import { send } from '../bridge.js';
defineProps({ panel: { type: String, default: 'full' } });
const root = ref(null);
const state = reactive({ minutes: 988, season: 'summer', weather: 'clear', hidden: false });
const clock = computed(() => String(Math.floor(state.minutes / 60)).padStart(2, '0') + ':' + String(state.minutes % 60).padStart(2, '0'));
const visibilityLabel = computed(() => state.hidden ? 'Показать интерфейс' : 'Скрыть интерфейс');
watch(() => state.hidden, value => document.body.classList.toggle('ui-hidden', value));
onUnmounted(() => document.body.classList.remove('ui-hidden'));
function setSeason(season) { state.season = season; send('scene.setSeason', {season}); }
function setWeather(weather) { state.weather = weather; send('scene.setWeather', {weather}); }
function sendTime() { send('scene.setTime', {minutes: state.minutes, hours: state.minutes / 60}); }
function action(method) {
  if (method === 'ui.toggleVisibility') { state.hidden = !state.hidden; send(method, {visible: !state.hidden}); }
  else send(method);
}
function setState(next) {
  if (!next || typeof next !== 'object') return;
  if (typeof next.minutes === 'number' && Number.isFinite(next.minutes)) state.minutes = Math.max(0, Math.min(1439, Math.round(next.minutes)));
  if (['summer', 'autumn', 'winter'].includes(next.season)) state.season = next.season;
  if (['clear', 'partlyCloudy', 'overcast', 'rain'].includes(next.weather)) state.weather = next.weather;
  if (typeof next.hidden === 'boolean') state.hidden = next.hidden;
}
defineExpose({setState, getState: () => ({...state}), focus: () => root.value.querySelector('button').focus()});
</script>
<template>
  <main ref="root" id="presentation" aria-label="Управление презентацией">
    <section v-if="panel === 'full' || panel === 'environment'" class="top" aria-label="Окружение">
      <div class="glass project"><span>«Идель. Квартал на Сенной»</span><img src="assets/brand.svg" alt="" width="24" height="24"></div>
      <div class="glass logo"><img src="assets/logo.svg" alt="Идель" width="114" height="20"></div>
      <div class="glass environment">
        <div class="time-heading"><img src="assets/moon.svg" alt="" width="20" height="20"><output id="clock">{{ clock }}</output><img src="assets/horizon.svg" alt="" width="20" height="20"></div>
        <input id="time" type="range" min="0" max="1439" v-model.number="state.minutes" :style="{'--progress': (state.minutes / 1439 * 100) + '%'}" @change="sendTime" aria-label="Время суток">
        <div class="seasons" role="group" aria-label="Время года">
          <button data-season="summer" :aria-pressed="state.season === 'summer'" @click="setSeason('summer')">Весна / Лето</button><button data-season="autumn" :aria-pressed="state.season === 'autumn'" @click="setSeason('autumn')">Осень</button><button data-season="winter" :aria-pressed="state.season === 'winter'" @click="setSeason('winter')">Зима</button>
        </div>
        <div class="weather" role="group" aria-label="Погода">
          <button data-weather="clear" :aria-pressed="state.weather === 'clear'" @click="setWeather('clear')" aria-label="Ясно" title="Ясно"><img src="assets/sun.svg" alt=""></button>
          <button data-weather="partlyCloudy" :aria-pressed="state.weather === 'partlyCloudy'" @click="setWeather('partlyCloudy')" aria-label="Переменная облачность" title="Переменная облачность"><img src="assets/partly.svg" alt=""></button>
          <button data-weather="overcast" :aria-pressed="state.weather === 'overcast'" @click="setWeather('overcast')" aria-label="Пасмурно" title="Пасмурно"><img src="assets/cloud.svg" alt=""></button>
          <button data-weather="rain" :aria-pressed="state.weather === 'rain'" @click="setWeather('rain')" aria-label="Дождь" title="Дождь"><img src="assets/rain.svg" alt=""></button>
        </div>
      </div>
    </section>
    <button v-if="panel === 'full' || panel === 'compass'" class="compass" data-action="scene.resetNorth" @click="action('scene.resetNorth')" title="На север" aria-label="На север"><img src="assets/compass.svg" alt=""></button>
    <nav v-if="panel === 'full' || panel === 'toolbar'" class="bottom" aria-label="Действия">
      <div class="toolbar">
        <button data-action="scene.home" @click="action('scene.home')" class="primary" title="Домой" aria-label="Домой"><img src="assets/house.svg" alt=""></button>
        <button data-action="ui.info" @click="action('ui.info')" title="О проекте" aria-label="О проекте"><img src="assets/info.svg" alt=""></button>
        <button data-action="scene.screenshot" @click="action('scene.screenshot')" title="Снимок экрана" aria-label="Снимок экрана"><img src="assets/camera.svg" alt=""></button>
        <button id="visibility" data-action="ui.toggleVisibility" @click="action('ui.toggleVisibility')" :title="visibilityLabel" :aria-label="visibilityLabel" :aria-pressed="state.hidden"><img src="assets/hide.svg" alt=""></button>
        <button data-action="ui.gallery" @click="action('ui.gallery')" title="Галерея" aria-label="Галерея"><img src="assets/gallery.svg" alt=""></button>
      </div>
      <div class="selection"><button class="primary apartments" data-action="ui.apartments" @click="action('ui.apartments')"><img src="assets/buildings.svg" alt="">Выбор квартир</button><button data-action="ui.favorites" @click="action('ui.favorites')" title="Избранное" aria-label="Избранное"><img src="assets/heart.svg" alt=""></button></div>
    </nav>
  </main>
</template>
