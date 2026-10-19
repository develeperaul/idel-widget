<script setup>
defineEmits(['exit']);
</script>

<template>
  <button class="session-exit-button" type="button" data-action="ui.session.end"
    aria-label="Завершить сессию" title="Завершить сессию" @click="$emit('exit')">
    <img src="assets/apartments/exit.svg" alt="" width="36" height="36">
  </button>
</template>
