<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import VirtualKeyboard from './VirtualKeyboard.vue';
const emit = defineEmits(['close', 'enter']);
const phone = ref(null);
const field = ref(null);
const toggle = ref(null);
const listRoot = ref(null);
const root = ref(null);
const value = ref('');
const selected = ref(null);
const error = ref('');
const listOpen = ref(false);
const managers = ['Светлана Юрьевна Павлова', 'Дмитрий Алексеевич Кузнецов', 'Анна Викторовна Попова', 'Максим Игоревич Соколов', 'Ольга Николаевна Морозова', 'Артём Павлович Волков', 'Мария Денисовна Васильева', 'Кирилл Евгеньевич Новиков', 'Наталья Олеговна Фёдорова', 'Илья Романович Михайлов'];
const valid = computed(() => /^7\d{10}$/.test(value.value.replace(/\D/g, '')));
function updatePhone() {
  const changed = value.value !== phone.value.value;
  value.value = phone.value.value;
  if (changed) selected.value = null;
  if (!valid.value) listOpen.value = false;
  error.value = '';
}
  function maskPhone() {
    var raw = phone.value.value;
    var caret = phone.value.selectionStart || 0;
    var count = raw.slice(0, caret).replace(/\D/g, '').length;
    var digits = raw.replace(/\D/g, '');
    var prefix = /^\s*\+7/.test(raw) || (digits.length === 11 && /^[78]/.test(digits));
    if (prefix) { digits = digits.slice(1); count = Math.max(0, count - 1); }
    digits = digits.slice(0, 10);
    var formatted = digits ? '+7 (' + digits.slice(0, 3) : '';
    if (digits.length > 3) formatted += ') ' + digits.slice(3, 6);
    if (digits.length > 6) formatted += '-' + digits.slice(6, 8);
    if (digits.length > 8) formatted += '-' + digits.slice(8, 10);
    phone.value.value = formatted;
    var position = formatted ? 4 : 0;
    var seen = 0;
    while (position < formatted.length && seen < count) {
      if (/\d/.test(formatted[position])) seen++;
      position++;
    }
    phone.value.setSelectionRange(position, position);
    updatePhone();
  }

  function edit(value) {
    if (!phone.value.value && (value === 'backspace' || value === 'delete')) return;
    var start = phone.value.selectionStart === null ? phone.value.value.length : phone.value.selectionStart;
    var end = phone.value.selectionEnd === null ? start : phone.value.selectionEnd;
    if (value !== 'backspace' && value !== 'delete' && !/^\d+$/.test(value)) return;
    if (value === 'backspace' && start === end) {
      while (start > 4 && !/\d/.test(phone.value.value[start - 1])) start--;
      start = Math.max(4, start - 1);
    }
    if (value === 'delete' && start === end) {
      while (end < phone.value.value.length && !/\d/.test(phone.value.value[end])) end++;
      end = Math.min(phone.value.value.length, end + 1);
    }
    if (phone.value.value) { start = Math.max(4, start); end = Math.max(start, end); }
    var insert = value === 'backspace' || value === 'delete' ? '' : value;
    if (phone.value.value.length - (end - start) + insert.length > phone.value.maxLength) return;
    phone.value.setRangeText(insert, start, end, 'end'); maskPhone(); phone.value.focus();
  }

function clear() { phone.value.value = ''; updatePhone(); phone.value.focus(); }
async function choose(index) {
  selected.value = { id: 'mock-manager-' + (index + 1), name: managers[index] };
  listOpen.value = false; error.value = '';
  await nextTick(); toggle.value.focus();
}
async function submit() {
  if (!valid.value) { error.value = 'Введите корректный номер телефона: +7 и 10 цифр.'; phone.value.focus(); return; }
  if (!selected.value) { listOpen.value = true; await nextTick(); listRoot.value.querySelector('button').focus(); return; }
  finish(false);
}
function finish(guest) {
  const session = {mode: guest ? 'guest' : 'manager', mock: true, manager: guest ? null : {...selected.value}};
  reset();
  emit('enter', session);
}
function reset() { value.value = ''; phone.value.value = ''; selected.value = null; error.value = ''; listOpen.value = false; }
function remove(event) {
  const backward = event.key === 'Backspace' || event.inputType === 'deleteContentBackward';
  const forward = event.key === 'Delete' || event.inputType === 'deleteContentForward';
  if (backward || forward) { event.preventDefault(); edit(backward ? 'backspace' : 'delete'); }
}
function outside(event) { if (!field.value.contains(event.target)) listOpen.value = false; }
function escape(event) {
  if (event.key !== 'Escape' || root.value.hidden) return;
  if (listOpen.value) { listOpen.value = false; toggle.value.focus(); }
  else emit('close');
}
onMounted(() => { document.addEventListener('click', outside); document.addEventListener('keydown', escape); });
onUnmounted(() => { document.removeEventListener('click', outside); document.removeEventListener('keydown', escape); });
defineExpose({reset, focus: () => phone.value.focus()});
</script>
<template>
  <section id="session-screen" ref="root" aria-label="Вход в сессию">
    <form id="session-form" class="session-panel glass" novalidate @submit.prevent="submit">
      <button type="button" id="session-close" @click="emit('close')" class="session-close" title="Закрыть" aria-label="Закрыть"><img src="assets/close.svg" alt=""></button>
      <h1>Вход в сессию</h1>
      <p class="session-description">Введите ваши данные для входа в сессию.<br>Для просмотра презентации без авторизации воспользуйтесь «Гостевым входом».</p>
      <div class="session-fields">
        <div class="phone-field"><label for="phone">Телефон<input id="phone" ref="phone" :value="value" :aria-invalid="error ? true : undefined" @input="maskPhone" @keydown="remove" @beforeinput="remove" type="tel" inputmode="tel" autocomplete="off" placeholder="+7 (999) 999-99-99" maxlength="40" aria-describedby="session-error"></label><button type="button" id="phone-clear" @click="clear" title="Очистить телефон" aria-label="Очистить телефон"><img src="assets/close.svg" alt=""></button></div>
        <div id="manager-field" ref="field" :hidden="!valid"><button type="button" id="manager-toggle" ref="toggle" :aria-expanded="listOpen" @click="listOpen = !listOpen" aria-controls="manager-list"><span><small>Выберите менеджера</small><span id="manager-name">{{ selected ? selected.name : 'Выберите менеджера' }}</span></span><img src="assets/caret.svg" alt=""></button>
          <aside id="manager-list" ref="listRoot" class="glass" :hidden="!listOpen" aria-label="Менеджеры"><p>Выберите менеджера</p><div id="manager-options"><button v-for="(name, index) in managers" :key="name" type="button" :data-manager="index" :aria-pressed="selected?.name === name" @click="choose(index)"><span>{{ name }}</span><img src="assets/check.svg" alt="" :hidden="selected?.name !== name"></button></div></aside>
        </div>
      </div>
      <p id="session-error" role="alert">{{ error }}</p>
      <VirtualKeyboard @key="edit" />
      <div class="session-actions"><button type="submit" class="primary">Войти</button><button type="button" id="guest" @click="finish(true)">Гостевой вход</button></div>
    </form>
  </section>
</template>
