<script setup>
defineProps({ name: String });
</script>
<template><span class="apt-icon" :class="{ 'apt-icon-large': ['left', 'right', 'caret', 'exit'].includes(name) }" aria-hidden="true"><img :src="`assets/apartments/${name}.svg`" alt=""></span></template>
