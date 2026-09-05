<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import WelcomeScreen from './components/WelcomeScreen.vue';
import SessionForm from './components/SessionForm.vue';
import PresentationPanel from './components/PresentationPanel.vue';
import { send } from './bridge.js';

const query = new URLSearchParams(location.search);
const panel = ['environment', 'toolbar', 'compass', 'session'].includes(query.get('panel')) ? query.get('panel') : 'full';
const isolated = ['environment', 'toolbar', 'compass'].includes(panel);
const screen = ref(isolated ? 'presentation' : 'welcome');
const session = ref(null);
const presentation = ref(null);
const form = ref(null);
const welcome = ref(null);
async function start() { screen.value = 'session'; await nextTick(); form.value.focus(); }
async function reset() {
  session.value = null;
  screen.value = isolated ? 'presentation' : 'welcome';
  form.value.reset();
  presentation.value.setState({ hidden: false });
  await nextTick();
  if (!isolated) welcome.value.focus();
}
async function finish(value) {
  console.log('IDEL:DEBUG finish() called with', JSON.stringify(value));
  session.value = value;
  screen.value = panel === 'session' ? 'complete' : 'presentation';
  presentation.value.setState({ hidden: false });
  const snapshot = JSON.parse(JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('idel-session', { detail: snapshot }));
  send('session.started', snapshot);
  console.log('IDEL:DEBUG session.started sent, screen =', screen.value);
  await nextTick();
  if (screen.value === 'presentation') presentation.value.focus();
}
onMounted(() => {
  document.body.classList.toggle('preview', !isolated && query.get('mode') !== 'unreal');
  document.body.dataset.panel = panel;
  window.IdelWidget = { getState: () => presentation.value.getState(), setState: value => presentation.value.setState(value) };
  window.IdelSession = { getState: () => session.value ? JSON.parse(JSON.stringify(session.value)) : null, reset };
  console.log('IDEL:DEBUG onMounted panel=' + panel + ' isolated=' + isolated);
  send('ui.ready', { version: 1, panel });
});
onUnmounted(() => { delete window.IdelWidget; delete window.IdelSession; delete document.body.dataset.panel; });
</script>

<template>
  <WelcomeScreen ref="welcome" :hidden="screen !== 'welcome'" @start="start" />
  <SessionForm ref="form" :hidden="screen !== 'session'" @close="reset" @enter="finish" />
  <PresentationPanel ref="presentation" :panel="panel" :hidden="screen !== 'presentation'" />
</template>
