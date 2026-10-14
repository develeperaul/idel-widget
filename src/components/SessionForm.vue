<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import VirtualKeyboard from './VirtualKeyboard.vue';
import { realSessionEnabled, loadSessionManagers, createPresentationSession, registerPresentationSession, parseSessionName, sessionConsentUrl } from '../api/session.js';

const emit = defineEmits(['close', 'enter']);
const phone = ref(null);
const fio = ref(null);
const keyboard = ref(null);
const field = ref(null);
const toggle = ref(null);
const listRoot = ref(null);
const root = ref(null);
const consentInput = ref(null);
const step = ref('phone');
const value = ref('');
const fullName = ref('');
const consent = ref(false);
const selected = ref(null);
const managers = ref([]);
const error = ref('');
const invalidField = ref('');
const managerError = ref('');
const managersLoading = ref(false);
const listOpen = ref(false);
const busy = ref(false);
const valid = computed(() => /^7\d{10}$/.test(value.value.replace(/\D/g, '')));
const registration = computed(() => step.value === 'registration');
const assetSet = computed(() => registration.value ? (listOpen.value ? '1' : '2') : '0');
const preview = new URLSearchParams(location.search).get('mode') !== 'unreal';
const consentUrl = sessionConsentUrl();
let requestEpoch = 0;
let requestController = null;
let managerEpoch = 0;
let managerController = null;

function clearError() { error.value = ''; invalidField.value = ''; }
function cancelRequest() { requestEpoch++; requestController?.abort(); requestController = null; busy.value = false; }
function cancelManagers() { managerEpoch++; managerController?.abort(); managerController = null; managersLoading.value = false; }
function clearRegistration() {
  cancelManagers(); fullName.value = ''; consent.value = false; selected.value = null;
  managers.value = []; managerError.value = ''; listOpen.value = false;
}
function reset() {
  cancelRequest(); clearRegistration(); clearError(); step.value = 'phone'; value.value = '';
  if (phone.value) phone.value.value = '';
  if (fio.value) fio.value.value = '';
  keyboard.value?.reset();
}
async function goBack() {
  cancelRequest(); clearRegistration(); clearError(); step.value = 'phone'; keyboard.value?.reset();
  await nextTick(); phone.value?.focus();
}
function close() { reset(); emit('close'); }
function updatePhone() {
  if (value.value !== phone.value.value && busy.value) cancelRequest();
  value.value = phone.value.value; clearError();
}
function maskPhone() {
  if (registration.value) return;
  const raw = phone.value.value;
  const caret = phone.value.selectionStart || 0;
  let count = raw.slice(0, caret).replace(/\D/g, '').length;
  let digits = raw.replace(/\D/g, '');
  const prefix = /^\s*\+7/.test(raw) || (digits.length === 11 && /^[78]/.test(digits));
  if (prefix) { digits = digits.slice(1); count = Math.max(0, count - 1); }
  digits = digits.slice(0, 10);
  let formatted = digits ? '+7 (' + digits.slice(0, 3) : '';
  if (digits.length > 3) formatted += ') ' + digits.slice(3, 6);
  if (digits.length > 6) formatted += '-' + digits.slice(6, 8);
  if (digits.length > 8) formatted += '-' + digits.slice(8, 10);
  phone.value.value = formatted;
  let position = formatted ? 4 : 0;
  let seen = 0;
  while (position < formatted.length && seen < count) {
    if (/\d/.test(formatted[position])) seen++;
    position++;
  }
  phone.value.setSelectionRange(position, position); updatePhone();
}
function edit(key) {
  if (busy.value) return;
  if (registration.value) {
    const input = fio.value;
    if (!input) return;
    let start = input.selectionStart ?? input.value.length;
    let end = input.selectionEnd ?? start;
    if (key === 'backspace' && start === end) start = Math.max(0, start - 1);
    if (key === 'delete' && start === end) end = Math.min(input.value.length, end + 1);
    const insert = key === 'backspace' || key === 'delete' ? '' : key;
    if (input.value.length - (end - start) + insert.length > input.maxLength) return;
    input.setRangeText(insert, start, end, 'end'); fullName.value = input.value;
    clearError(); input.focus(); return;
  }
  const input = phone.value;
  if (!input.value && (key === 'backspace' || key === 'delete')) return;
  let start = input.selectionStart === null ? input.value.length : input.selectionStart;
  let end = input.selectionEnd === null ? start : input.selectionEnd;
  if (key !== 'backspace' && key !== 'delete' && !/^\d+$/.test(key)) return;
  if (key === 'backspace' && start === end) {
    while (start > 4 && !/\d/.test(input.value[start - 1])) start--;
    start = Math.max(4, start - 1);
  }
  if (key === 'delete' && start === end) {
    while (end < input.value.length && !/\d/.test(input.value[end])) end++;
    end = Math.min(input.value.length, end + 1);
  }
  if (input.value) { start = Math.max(4, start); end = Math.max(start, end); }
  const insert = key === 'backspace' || key === 'delete' ? '' : key;
  if (input.value.length - (end - start) + insert.length > input.maxLength) return;
  input.setRangeText(insert, start, end, 'end'); maskPhone(); input.focus();
}
function clearPhone() { if (busy.value) return; phone.value.value = ''; updatePhone(); phone.value.focus(); }
function clearName() { if (busy.value) return; fullName.value = ''; fio.value.value = ''; clearError(); fio.value.focus(); }
function remove(event) {
  if (registration.value) return;
  const backward = event.key === 'Backspace' || event.inputType === 'deleteContentBackward';
  const forward = event.key === 'Delete' || event.inputType === 'deleteContentForward';
  if (backward || forward) { event.preventDefault(); edit(backward ? 'backspace' : 'delete'); }
}
async function loadManagers() {
  if (!registration.value || managersLoading.value) return;
  const epoch = ++managerEpoch;
  managerController = new AbortController();
  managersLoading.value = true; managerError.value = '';
  try {
    const items = await loadSessionManagers({ signal: managerController.signal });
    if (epoch !== managerEpoch || !registration.value) return;
    managers.value = items;
    if (!items.length) managerError.value = 'Список менеджеров пока пуст. Попробуйте загрузить его ещё раз.';
    if (selected.value && !items.some(manager => manager.id === selected.value.id)) selected.value = null;
  } catch (cause) {
    if (epoch === managerEpoch && cause.name !== 'AbortError') managerError.value = cause.message || 'Не удалось загрузить менеджеров.';
  } finally {
    if (epoch === managerEpoch) { managersLoading.value = false; managerController = null; }
  }
}
async function openManagers(focusFirst = false) {
  if (busy.value || !registration.value) return;
  listOpen.value = !listOpen.value;
  if (listOpen.value && !managers.value.length && !managersLoading.value) await loadManagers();
  if (focusFirst && listOpen.value) { await nextTick(); listRoot.value?.querySelector('button')?.focus(); }
}
async function choose(index) {
  if (busy.value || !managers.value[index]) return;
  selected.value = { ...managers.value[index] }; listOpen.value = false; clearError();
  await nextTick(); toggle.value?.focus();
}
async function showRegistration(result, epoch) {
  clearRegistration(); step.value = 'registration';
  const digits = result.phone.replace(/\D/g, '');
  value.value = `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  busy.value = false;
  await nextTick();
  if (epoch !== requestEpoch || !registration.value) return;
  fio.value?.focus(); await loadManagers();
}
function validationError(message, name, input) { error.value = message; invalidField.value = name; input?.focus(); }
async function submit() {
  if (busy.value) return;
  if (!valid.value) { validationError('Введите корректный номер телефона: +7 и 10 цифр.', 'phone', phone.value); return; }
  let names;
  if (registration.value) {
    try { names = parseSessionName(fullName.value); }
    catch (cause) { validationError(cause.message, 'fio', fio.value); return; }
    if (!selected.value || !managers.value.some(manager => manager.id === selected.value.id)) {
      selected.value = null; validationError('Выберите менеджера из списка.', 'manager', toggle.value);
      if (!listOpen.value) await openManagers(true);
      return;
    }
    if (!consent.value) { validationError('Для регистрации необходимо согласие на обработку персональных данных.', 'consent', consentInput.value); return; }
  }
  await finish(false, names);
}
async function finish(guest, names) {
  if (busy.value) return;
  const registering = !guest && registration.value;
  const enteredPhone = value.value;
  const epoch = ++requestEpoch;
  requestController = new AbortController();
  const signal = requestController.signal;
  busy.value = true; clearError(); listOpen.value = false;
  try {
    let result;
    if (registering) {
      try { result = await registerPresentationSession({ phone: enteredPhone, ...names, managerId: selected.value.id, consent: consent.value }, { signal }); }
      catch (cause) {
        if (epoch !== requestEpoch) return;
        if (cause.status !== 409 || cause.code !== 'client_exists') throw cause;
        result = await createPresentationSession({ mode: 'manager', phone: enteredPhone }, { signal });
        if (epoch !== requestEpoch) return;
        if (result.registrationRequired) {
          await goBack(); error.value = 'Клиент уже зарегистрирован. Повторите вход по телефону.'; return;
        }
      }
    } else result = await createPresentationSession({ mode: guest ? 'guest' : 'manager', phone: guest ? undefined : enteredPhone }, { signal });
    if (epoch !== requestEpoch) return;
    if (result.registrationRequired) { await showRegistration(result, epoch); return; }
    // This Vue emit is private; App owns the public, redacted console bridge.
    const session = { ...result, phone: guest ? null : enteredPhone, manager: result.manager || null, client: result.client || null };
    reset(); emit('enter', session);
  } catch (cause) {
    if (epoch === requestEpoch && cause.name !== 'AbortError') error.value = cause.message || 'Не удалось войти. Попробуйте ещё раз.';
  } finally {
    if (epoch === requestEpoch) { busy.value = false; requestController = null; }
  }
}
function outside(event) { if (!field.value?.contains(event.target)) listOpen.value = false; }
function escape(event) {
  if (event.key !== 'Escape' || root.value?.hidden) return;
  if (listOpen.value) { listOpen.value = false; toggle.value?.focus(); }
  else close();
}
onMounted(() => { document.addEventListener('click', outside); document.addEventListener('keydown', escape); });
onUnmounted(() => { cancelRequest(); cancelManagers(); document.removeEventListener('click', outside); document.removeEventListener('keydown', escape); });
defineExpose({ reset, focus: () => (registration.value ? fio.value : phone.value)?.focus() });
</script>
<template>
  <section id="session-screen" ref="root" :data-step="step" :data-mock="!realSessionEnabled" aria-label="Вход в сессию">
    <img v-if="preview" class="session-background" :src="`assets/session/${assetSet}-imgImage377.png`" width="4000" height="2232" alt="">
    <form id="session-form" class="session-panel glass" :class="{'session-registration': registration}" :aria-busy="busy" novalidate @submit.prevent="submit">
      <button v-if="registration" type="button" id="session-back" class="session-back" @click="goBack" title="Назад" aria-label="Назад">
        <span class="session-icon"><span class="session-icon-art"><img :src="`assets/session/${assetSet}-imgArrowLeft.svg`" alt=""></span></span>
      </button>
      <button type="button" id="session-close" @click="close" class="session-close" title="Закрыть" aria-label="Закрыть">
        <span class="session-icon"><span class="session-icon-art"><img :src="`assets/session/${registration ? (listOpen ? '1-imgX' : '2-imgX1') : '0-imgX1'}.svg`" alt=""></span></span>
      </button>
      <header class="session-heading">
        <h1>{{ registration ? 'Регистрация' : 'Вход в сессию' }}</h1>
        <p class="session-description" v-if="registration">Укажите ФИО и выберите менеджера</p>
        <p class="session-description" v-else>Введите ваши данные для входа в сессию.<br>Для просмотра презентации без авторизации воспользуйтесь «Гостевым входом».</p>
      </header>
      <div class="session-fields">
        <div class="phone-field" :class="{'session-phone-locked': registration}">
          <label for="phone">Телефон<input id="phone" ref="phone" :value="value" :readonly="registration" :disabled="busy && !registration" :aria-invalid="invalidField === 'phone' ? true : undefined" @input="maskPhone" @keydown="remove" @beforeinput="remove" type="tel" inputmode="tel" autocomplete="off" placeholder="+7 (999) 999-99-99" maxlength="40" aria-describedby="session-error"></label>
          <span v-if="registration" class="session-field-icon" aria-label="Телефон заблокирован"><span class="session-icon"><span class="session-icon-art"><img :src="`assets/session/${assetSet}-imgLock.svg`" alt=""></span></span></span>
          <button v-else type="button" id="phone-clear" :disabled="busy" @click="clearPhone" title="Очистить телефон" aria-label="Очистить телефон"><span class="session-icon"><span class="session-icon-art"><img src="assets/session/0-imgX.svg" alt=""></span></span></button>
        </div>
        <div v-if="registration" class="session-registration-fields">
          <div class="fio-field">
            <label for="fio">ФИО<input id="fio" ref="fio" v-model="fullName" :disabled="busy" @input="clearError" :aria-invalid="invalidField === 'fio' ? true : undefined" type="text" autocomplete="off" placeholder="Иванов Иван Иванович" maxlength="200" aria-describedby="session-error"></label>
            <button type="button" id="fio-clear" :disabled="busy" @click="clearName" title="Очистить ФИО" aria-label="Очистить ФИО"><span class="session-icon"><span class="session-icon-art"><img src="assets/session/2-imgX.svg" alt=""></span></span></button>
          </div>
          <div id="manager-field" ref="field">
            <button type="button" id="manager-toggle" ref="toggle" :disabled="busy" :aria-expanded="listOpen" :aria-invalid="invalidField === 'manager' ? true : undefined" @click="openManagers()" @keydown.down.prevent="listOpen ? listRoot?.querySelector('button')?.focus() : openManagers(true)" aria-controls="manager-list" aria-describedby="manager-error session-error">
              <span class="manager-label"><small v-if="selected || listOpen">Выберите менеджера</small><span id="manager-name">{{ selected ? selected.name : (listOpen ? '|' : 'Выберите менеджера') }}</span></span>
              <span class="session-field-icon"><span class="session-icon"><span class="session-icon-art"><img :src="listOpen ? 'assets/session/1-imgCaretLeft.svg' : 'assets/session/2-imgCaretRight.svg'" alt=""></span></span></span>
            </button>
            <aside id="manager-list" ref="listRoot" class="glass" :hidden="!listOpen" aria-label="Менеджеры">
              <p>Выберите менеджера</p>
              <div id="manager-options"><button v-for="(manager, index) in managers" :key="manager.id" type="button" :data-manager="index" :aria-pressed="selected?.id === manager.id" @click="choose(index)"><span>{{ manager.name }}</span><span v-if="selected?.id === manager.id" class="session-icon session-icon-small"><span class="session-icon-art"><img src="assets/session/1-imgCheck.svg" alt=""></span></span></button></div>
              <p v-if="managersLoading" role="status">Загрузка менеджеров…</p>
              <p v-else-if="!managers.length">Менеджеры пока недоступны.</p>
            </aside>
          </div>
          <p v-if="managersLoading" class="session-manager-status" role="status">Загрузка менеджеров…</p>
          <p v-if="managerError" id="manager-error" class="session-manager-error" role="alert">{{ managerError }} <button type="button" :disabled="managersLoading || busy" @click="loadManagers">Повторить</button></p>
        </div>
      </div>
      <p id="session-error" role="alert">{{ error }}</p>
      <VirtualKeyboard ref="keyboard" :asset-set="assetSet" :disabled="busy" @key="edit" />
      <div class="session-actions">
        <button type="submit" class="primary" :disabled="busy">{{ busy ? 'Вход…' : 'Войти' }}</button>
        <button v-if="!registration" type="button" id="guest" :disabled="busy" @click="finish(true)">Гостевой вход</button>
        <label v-else class="session-consent" :class="{'session-consent-invalid': invalidField === 'consent'}">
          <span class="session-consent-control"><input id="session-consent" ref="consentInput" v-model="consent" :disabled="busy" :aria-invalid="invalidField === 'consent' ? true : undefined" @change="clearError" type="checkbox" aria-describedby="session-error"><span class="session-icon session-icon-small" aria-hidden="true"><span class="session-icon-art"><img :src="`assets/session/${assetSet}-imgSquare.svg`" alt=""></span></span><span v-if="consent" class="session-consent-check" aria-hidden="true"><span class="session-icon session-icon-small"><span class="session-icon-art"><img src="assets/session/1-imgCheck.svg" alt=""></span></span></span></span>
          <span>Я соглашаюсь на обработку моих персональных данных в соответствии с <a v-if="consentUrl" class="session-consent-document" :href="consentUrl" target="_blank" rel="noopener noreferrer" @click.stop>Согласием на обработку персональных данных</a><span v-else class="session-consent-document">Согласием на обработку персональных данных</span></span>
        </label>
      </div>
    </form>
    <p v-if="preview" class="session-credit">Дизайн и Разработка Есть Идея</p>
    <p v-if="!realSessionEnabled" class="session-demo">Демо-режим</p>
  </section>
</template>
