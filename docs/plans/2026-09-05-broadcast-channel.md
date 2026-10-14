# BroadcastChannel: связь между тремя панелями

> **Для агентов:** Используй subagent-driven-development для пошаговой реализации.

**Цель:** Связать три компактных браузера (Environment, Toolbar, Compass) через BroadcastChannel, чтобы изменения в одном отражались в других.

**Архитектура:**
- Три отдельных UMG Web Browser загружают один `index.html` с разными `?panel=`
- Каждый запускает свой экземпляр Vue приложения
- BroadcastChannel позволяет им обмениваться состоянием напрямую (один origin)
- Unreal Blueprint остаётся посредником для команд в 3D-сцену

**Tech Stack:** Vue 3, BroadcastChannel API, Vite

---

## Текущая проблема

```
BrowserEnvironment (panel=environment)  ──?──  BrowserToolbar (panel=toolbar)
         │                                          │
         └──?──  BrowserCompass (panel=compass) ────┘
```

Каждый браузер — изолированный Vue экземпляр. Нет связи между ними.

## Целевая архитектура

```
BrowserSession ──session.started──► BroadcastChannel ──► BrowserEnvironment
       │                                                BrowserToolbar
       │                                                BrowserCompass
       ▼
  Unreal Blueprint (On Console Message → Set Input Mode)
```

---

## Файлы

| Файл | Действие | Ответственность |
|---|---|---|
| `src/channel.js` | **Создать** | BroadcastChannel обёртка: subscribe, publish, disconnect |
| `src/App.vue` | **Изменить** | Подключить channel, слушать state updates, рассылать session.started |
| `src/components/PresentationPanel.vue` | **Изменить** | При changes в state → publish в channel |
| `src/main.js` | **Изменить** | Передавать channel в App |
| `build/app.js` | **Пересобрать** | `npm run build` |

---

## Задачи

### Task 1: Создать `src/channel.js`

**Файл:** `src/channel.js`

- [ ] **Step 1: Написать модуль channel.js**

```js
const CHANNEL_NAME = 'idel';
let channel = null;
const listeners = new Set();

export function connect() {
  if (channel) return;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      listeners.forEach(fn => fn(type, payload));
    };
  } catch (e) {
    console.warn('IDEL: BroadcastChannel not supported', e);
  }
}

export function publish(type, payload) {
  if (!channel) return;
  channel.postMessage({ type, payload });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function disconnect() {
  if (channel) {
    channel.close();
    channel = null;
  }
  listeners.clear();
}
```

- [ ] **Step 2: Запустить тест (если есть) или проверить импорт**

Run: `node -e "const m = require('./src/channel.js'); console.log('OK')" 2>&1 || echo "ES module - checked manually"`

Expected: либо OK, либо ES module warning (нормально для Vite)

- [ ] **Step 3: Коммит**

```bash
git add src/channel.js
git commit -m "feat: add BroadcastChannel module for panel communication"
```

---

### Task 2: Подключить channel в App.vue

**Файл:** `src/App.vue`

- [ ] **Step 1: Импортировать channel и подключиться при mount**

В `<script setup>` добавить импорт:

```js
import { connect, publish, subscribe, disconnect } from './channel.js';
```

В `onMounted()` после существующего кода добавить:

```js
connect();
```

В `onUnmounted()` добавить:

```js
disconnect();
```

- [ ] **Step 2: Рассылать session.started через channel**

В функции `finish(value)` после `send('session.started', snapshot)` добавить:

```js
publish('session.started', snapshot);
```

- [ ] **Step 3: Слушать state updates от других панелей**

В `onMounted()` после `connect()` добавить:

```js
subscribe((type, payload) => {
  if (type === 'state.update' && presentation.value) {
    presentation.value.setState(payload);
  }
  if (type === 'session.reset') {
    session.value = null;
    if (!isolated) {
      screen.value = 'welcome';
    }
  }
});
```

- [ ] **Step 4: Коммит**

```bash
git add src/App.vue
git commit -m "feat: connect App.vue to BroadcastChannel for panel sync"
```

---

### Task 3: Публиковать изменения из PresentationPanel

**Файл:** `src/components/PresentationPanel.vue`

- [ ] **Step 1: Импортировать publish**

В `<script setup>` добавить:

```js
import { publish } from '../channel.js';
```

- [ ] **Step 2: Публиковать при изменении season**

В функции `setSeason(season)` после `send('scene.setSeason', { season })` добавить:

```js
publish('state.update', { season });
```

- [ ] **Step 3: Публиковать при изменении weather**

В функции `setWeather(weather)` после `send('scene.setWeather', { weather })` добавить:

```js
publish('state.update', { weather });
```

- [ ] **Step 4: Публиковать при изменении time**

В функции `sendTime()` после `send('scene.setTime', { minutes: state.minutes, hours: state.minutes / 60 })` добавить:

```js
publish('state.update', { minutes: state.minutes });
```

- [ ] **Step 5: Публиковать при toggle visibility**

В функции `action(method)` case `ui.toggleVisibility` после `send(method, { visible: !state.hidden })` добавить:

```js
publish('state.update', { hidden: state.hidden });
```

- [ ] **Step 6: Коммит**

```bash
git add src/components/PresentationPanel.vue
git commit -m "feat: publish state changes from PresentationPanel via BroadcastChannel"
```

---

### Task 4: Пересобрать и проверить

- [ ] **Step 1: Очистить кэш и собрать**

```bash
rm -rf node_modules/.cache node_modules/.vite build
npx vite build
```

Expected: `build/app.js 83 kB` (примерно)

- [ ] **Step 2: Запушить**

```bash
git add -A
git commit -m "feat: BroadcastChannel panel communication"
git push origin main
```

---

## Проверка в Unreal

1. Открой три Web Browser в WBP_IdelPreview
2. Запусти Play
3. В BrowserEnvironment поменяй сезон → в BrowserToolbar должен обновиться (если показывает сезон)
4. В BrowserSession залогинься → другие панели получат session.started

## Ожидаемый результат

```
Environment: меняю "Зима" ──► BroadcastChannel ──► Toolbar: видит зиму
                                          ──► Compass: видит зиму
                                          ──► Unreal: scene.setSeason (через console.log)
```
