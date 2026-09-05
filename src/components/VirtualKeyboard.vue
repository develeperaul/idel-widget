<script setup>
import { computed, ref } from 'vue';
const emit = defineEmits(['key']);
const language = ref('en');
const shift = ref(false);
const rows = computed(() => {
  const letters = language.value === 'en'
    ? ['1234567890-+', 'qwertyuiop_@', 'asdfghjkl\\', 'zxcvbnm.,']
    : ['1234567890-+', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбюё'];
  return letters.map((text, index) => {
    const keys = text.split('');
    if (index === 0) keys.push('backspace');
    if (index === 2) keys.push('shift');
    if (index === 3) keys.unshift('language');
    return keys;
  });
});
function label(key) {
  if (key === 'backspace') return 'Удалить символ';
  if (key === 'shift') return 'Верхний регистр';
  if (key === 'language') return language.value === 'en' ? 'Русская клавиатура' : 'Английская клавиатура';
  return shift.value ? key.toUpperCase() : key;
}
function press(key) {
  if (key === 'language') language.value = language.value === 'en' ? 'ru' : 'en';
  else if (key === 'shift') shift.value = !shift.value;
  else emit('key', key === 'backspace' ? key : label(key));
}
</script>
<template>
  <div id="keyboard" aria-label="Экранная клавиатура">
    <div v-for="(row, index) in rows" :key="index" class="key-row">
      <button v-for="key in row" :key="key" type="button" :class="{wide: key.length > 1}"
        :aria-label="label(key)" :aria-pressed="key === 'shift' ? shift : undefined"
        :title="key.length > 1 ? label(key) : undefined" @mousedown.prevent @click="press(key)">
        <template v-if="key === 'backspace' || key === 'shift'"><img :src="`assets/${key}.svg`" alt=""><span v-if="key === 'shift'" class="shift-label">SHIFT</span></template>
        <template v-else>{{ key === 'language' ? (language === 'en' ? 'RU' : 'EN') : label(key) }}</template>
      </button>
    </div>
    <div class="key-row"><button type="button" class="space" @mousedown.prevent @click="emit('key', ' ')">{{ language === 'en' ? 'SPACE' : 'ПРОБЕЛ' }}</button></div>
  </div>
</template>
