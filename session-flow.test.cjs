const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const { transformSync } = require('esbuild');
const vue = require('vue');

const token = 'a'.repeat(64);
const client = { id: 456, name: 'Иванов Иван Иванович' };
const manager = { id: 123, name: 'Тестовый менеджер' };
const phoneText = '+7 (999) 123-45-67';
const canonicalPhone = '+79991234567';
const plain = value => JSON.parse(JSON.stringify(value));
const session = (mode = 'manager') => ({ token, expiresAt: '2030-01-01T00:00:00Z', mode, ...(mode === 'manager' ? { client, manager } : {}) });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function evaluate(source, context, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(transformSync(source, { format: 'cjs', target: 'node18' }).code, {
    ...context, module, exports: module.exports,
    require: name => { if (name in dependencies) return dependencies[name]; throw new Error(`Unexpected dependency: ${name}`); },
  });
  return module.exports;
}
function runtime({ config = {}, fetch = () => { throw new Error('Unexpected API request'); } } = {}) {
  const context = {
    window: { IdelConfig: { apiBaseUrl: 'https://api.example.test/api', ...config } },
    location: { href: 'file:///widget/index.html', protocol: 'file:', search: '' },
    URL, URLSearchParams, AbortController, DOMException, fetch,
    console: { log() { throw new Error('Session code must not log private data'); } },
  };
  const catalog = evaluate(fs.readFileSync(path.join(__dirname, 'src/api/catalog.js'), 'utf8'), context);
  const api = evaluate(fs.readFileSync(path.join(__dirname, 'src/api/session.js'), 'utf8'), context, { './catalog.js': catalog });
  return { context, api, catalog };
}
function input(maxLength) {
  return {
    value: '', selectionStart: 0, selectionEnd: 0, maxLength, focused: false,
    focus() { this.focused = true; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    setRangeText(insert, start, end) { this.value = this.value.slice(0, start) + insert + this.value.slice(end); this.setSelectionRange(start + insert.length, start + insert.length); },
  };
}
function component(filename, context, api, props = {}) {
  const source = fs.readFileSync(path.join(__dirname, 'src/components', filename), 'utf8');
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: filename });
  assert.deepEqual(compileTemplate({ id: filename, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } }).errors, []);
  const mounted = [], unmounted = [], events = [];
  let exposed;
  const listeners = new Map();
  const module = evaluate(script.content, {
    ...context, document: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
  }, {
    vue: { ...vue, onMounted: fn => mounted.push(fn), onUnmounted: fn => unmounted.push(fn) },
    './VirtualKeyboard.vue': {}, '../api/session.js': api,
  });
  const state = module.default.setup(props, { emit: (name, value) => events.push({ name, value }), expose: value => { exposed = value; } });
  if (filename === 'SessionForm.vue') {
    state.phone.value = input(40); state.fio.value = input(200); state.root.value = { hidden: false };
    state.toggle.value = { focus() {} }; state.consentInput.value = { focus() {} };
    state.field.value = { contains: () => false }; state.listRoot.value = { querySelector: () => ({ focus() {} }) };
  }
  mounted.forEach(fn => fn());
  return { state, events, exposed, listeners, unmount: () => unmounted.forEach(fn => fn()) };
}
function form(options) { const rt = runtime(options); return { ...rt, ...component('SessionForm.vue', rt.context, rt.api) }; }
function fillPhone(state, value = phoneText) { state.phone.value.value = value; state.phone.value.setSelectionRange(value.length, value.length); state.maskPhone(); }
function fillName(state, value = client.name) { state.fullName.value = value; state.fio.value.value = value; state.fio.value.setSelectionRange(value.length, value.length); }
async function registration(f) { fillPhone(f.state); await f.state.submit(); fillName(f.state); await f.state.choose(0); }

// These tests execute the actual SFC setup and API modules, with controllable requests.
// Browser tests retain responsibility for layout, focus, and DOM event integration.
test('FIO parsing uses surname, given name and optional remaining words; explains invalid input', () => {
  const { api } = runtime();
  assert.deepEqual(plain(api.parseSessionName('  Иванов-Петров  Иван  ')), { lastName: 'Иванов-Петров', firstName: 'Иван' });
  assert.deepEqual(plain(api.parseSessionName('Ли Анна-Мария Ван Дер')), { lastName: 'Ли', firstName: 'Анна-Мария', middleName: 'Ван Дер' });
  for (const invalid of ['', 'Иванов', 'Иванов Иван2', '-Иванов Иван', 'Иванов- Иван']) assert.throws(() => api.parseSessionName(invalid), /фамилию и имя/);
});

test('mock registration is two steps; demo clients return by phone without a token or network', async () => {
  const f = form();
  assert.equal(f.state.managers.value.length, 0);
  await registration(f);
  assert.equal(f.state.step.value, 'registration');
  assert.equal(f.state.consent.value, false);
  await f.state.submit();
  assert.equal(f.state.invalidField.value, 'consent'); assert.equal(f.events.length, 0);
  f.state.selected.value = { id: 'unknown', name: 'Unknown' }; f.state.consent.value = true;
  await f.state.submit();
  assert.equal(f.state.invalidField.value, 'manager'); assert.equal(f.events.length, 0);
  await f.state.choose(2); await f.state.submit();
  const first = f.events[0].value;
  assert.equal(first.mock, true); assert.equal(first.token, undefined);
  assert.equal(first.client.name, client.name); assert.equal(first.manager.id, 'mock-manager-3');
  assert.equal(f.state.step.value, 'phone'); assert.equal(f.state.value.value, '');
  fillPhone(f.state); await f.state.submit();
  assert.equal(f.events[1].value.client.id, first.client.id);
  assert.equal(f.state.managers.value.length, 0);
  await f.state.finish(true);
  assert.equal(f.events[2].value.mode, 'guest'); assert.equal(f.events[2].value.client, null);
});

test('real known client and guest need no manager list; private DTO stays in Vue enter emit', async () => {
  const sent = [];
  const f = form({ config: { realSession: true }, fetch: async (url, options) => {
    sent.push({ path: new URL(url).pathname, body: JSON.parse(options.body) });
    return response({ item: session(sent.at(-1).body.mode) });
  } });
  fillPhone(f.state); await f.state.submit();
  assert.deepEqual(sent, [{ path: '/api/session', body: { mode: 'manager', phone: canonicalPhone } }]);
  assert.equal(f.events[0].value.token, token); assert.equal(f.events[0].value.client.name, client.name);
  assert.equal(f.events[0].value.mock, false); assert.equal(f.state.managers.value.length, 0);
  await f.state.finish(true);
  assert.deepEqual(sent[1].body, { mode: 'guest' });
});

test('real new client loads managers only after lookup and sends parsed FIO and explicit consent', async () => {
  const sent = [];
  const f = form({ config: { realSession: true }, fetch: async (url, options) => {
    const pathname = new URL(url).pathname; sent.push({ path: pathname, body: options.body && JSON.parse(options.body) });
    if (pathname.endsWith('/managers')) return response({ items: [manager, { id: -1, name: 'Invalid' }] });
    return response(pathname.endsWith('/register') ? { item: session() } : { registrationRequired: true, phone: canonicalPhone });
  } });
  assert.equal(sent.length, 0); await registration(f);
  assert.deepEqual(sent.map(value => value.path), ['/api/session', '/api/managers']);
  fillName(f.state, 'Иванов-Петров Иван'); f.state.consent.value = true; await f.state.submit();
  assert.deepEqual(sent[2], { path: '/api/session/register', body: { phone: canonicalPhone, lastName: 'Иванов-Петров', firstName: 'Иван', managerId: 123, consent: true } });
  assert.equal(f.events[0].value.client.id, client.id);
});

test('empty/error manager responses are retryable and never substitute mock managers', async () => {
  let attempts = 0;
  const f = form({ config: { realSession: true }, fetch: async url => {
    if (!new URL(url).pathname.endsWith('/managers')) return response({ registrationRequired: true, phone: canonicalPhone });
    attempts++; if (attempts === 1) return response({ error: { message: 'Менеджеры недоступны' } }, 503);
    return response({ items: attempts === 2 ? [] : [manager] });
  } });
  fillPhone(f.state); await f.state.submit();
  assert.match(f.state.managerError.value, /недоступны/); assert.equal(f.state.managers.value.length, 0);
  await f.state.loadManagers(); assert.match(f.state.managerError.value, /пуст/);
  await f.state.loadManagers(); assert.equal(f.state.managerError.value, ''); assert.equal(f.state.managers.value[0].id, 123);
});

test('lookup and registration failures preserve editable data and permit retry without mock fallback', async () => {
  let lookups = 0, registrations = 0;
  const f = form({ config: { realSession: true }, fetch: async url => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/managers')) return response({ items: [manager] });
    if (pathname.endsWith('/register')) { registrations++; return registrations === 1 ? response({ error: { message: 'Неизвестный менеджер', code: 'invalid_manager' } }, 400) : response({ item: session() }); }
    lookups++; return lookups === 1 ? response({ error: { message: 'Сервис временно недоступен' } }, 503) : response({ registrationRequired: true, phone: canonicalPhone });
  } });
  fillPhone(f.state); await f.state.submit();
  assert.match(f.state.error.value, /недоступен/); assert.equal(f.state.value.value, phoneText); assert.equal(f.state.busy.value, false);
  await f.state.submit(); fillName(f.state); await f.state.choose(0); f.state.consent.value = true; await f.state.submit();
  assert.match(f.state.error.value, /Неизвестный менеджер/); assert.equal(f.state.fullName.value, client.name); assert.equal(f.events.length, 0);
  await f.state.submit(); assert.equal(f.events.length, 1); assert.equal(f.events[0].value.mock, false);
});

test('409 client_exists repeats the first lookup rather than another registration', async () => {
  const sent = []; let lookups = 0;
  const f = form({ config: { realSession: true }, fetch: async url => {
    const pathname = new URL(url).pathname; sent.push(pathname);
    if (pathname.endsWith('/managers')) return response({ items: [manager] });
    if (pathname.endsWith('/register')) return response({ error: { code: 'client_exists', message: 'Уже зарегистрирован' } }, 409);
    return response(++lookups === 1 ? { registrationRequired: true, phone: canonicalPhone } : { item: session() });
  } });
  await registration(f); f.state.consent.value = true; await f.state.submit();
  assert.deepEqual(sent, ['/api/session', '/api/managers', '/api/session/register', '/api/session']);
  assert.equal(f.events.length, 1);
});

test('back retains phone, clears registration and ignores an aborted manager response', async () => {
  const pending = deferred(); let signal;
  const f = form({ config: { realSession: true }, fetch: async (url, options) => {
    if (new URL(url).pathname.endsWith('/managers')) { signal = options.signal; return pending.promise; }
    return response({ registrationRequired: true, phone: canonicalPhone });
  } });
  fillPhone(f.state); const submitting = f.state.submit();
  await new Promise(resolve => setImmediate(resolve));
  fillName(f.state); f.state.consent.value = true; f.state.listOpen.value = true;
  await f.state.goBack(); assert.equal(signal.aborted, true);
  pending.resolve(response({ items: [manager] })); await submitting;
  assert.equal(f.state.step.value, 'phone'); assert.equal(f.state.value.value, phoneText);
  assert.equal(f.state.fullName.value, ''); assert.equal(f.state.consent.value, false);
  assert.equal(f.state.listOpen.value, false); assert.equal(f.state.managers.value.length, 0); assert.equal(f.events.length, 0);
});

test('reset cancels lookup and stale completion cannot overwrite a newer guest session', async () => {
  const pending = deferred(); let signal;
  const f = form({ config: { realSession: true }, fetch: async (url, options) => {
    if (JSON.parse(options.body).mode === 'guest') return response({ item: session('guest') });
    signal = options.signal; return pending.promise;
  } });
  fillPhone(f.state); const submitting = f.state.submit();
  f.exposed.reset(); assert.equal(signal.aborted, true); assert.equal(f.state.value.value, '');
  await f.state.finish(true);
  pending.resolve(response({ item: session() })); await submitting;
  assert.equal(f.events.length, 1); assert.equal(f.events[0].value.mode, 'guest');
  assert.equal(f.state.busy.value, false);
});

test('double registration sends once; back cancels it and ignores a late session', async () => {
  const pending = deferred(); let registrations = 0, signal;
  const f = form({ config: { realSession: true }, fetch: async (url, options) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/managers')) return response({ items: [manager] });
    if (pathname.endsWith('/register')) { registrations++; signal = options.signal; return pending.promise; }
    return response({ registrationRequired: true, phone: canonicalPhone });
  } });
  await registration(f); f.state.consent.value = true;
  const submitting = f.state.submit(); await f.state.submit(); assert.equal(registrations, 1);
  await f.state.goBack(); assert.equal(signal.aborted, true);
  pending.resolve(response({ item: session() })); await submitting;
  assert.equal(f.events.length, 0); assert.equal(f.state.value.value, phoneText); assert.equal(f.state.consent.value, false);
});

test('phone masking and virtual edits protect prefix; the same keyboard edits FIO selections', async () => {
  const f = form();
  fillPhone(f.state, '89991234567'); assert.equal(f.state.value.value, phoneText);
  f.state.edit('backspace'); assert.equal(f.state.value.value, '+7 (999) 123-45-6');
  f.state.phone.value.setSelectionRange(9, 9); f.state.edit('backspace'); assert.equal(f.state.value.value, '+7 (991) 234-56');
  f.state.clearPhone(); f.state.edit('9'); f.state.edit('й'); assert.equal(f.state.value.value, '+7 (9');
  f.state.edit('backspace'); assert.equal(f.state.value.value, '');
  await registration(f); fillName(f.state, 'Иванов Иван');
  f.state.fio.value.setSelectionRange(7, 11); f.state.edit('Анна'); assert.equal(f.state.fullName.value, 'Иванов Анна');
  f.state.edit('backspace'); assert.equal(f.state.fullName.value, 'Иванов Анн');
  f.state.clearName(); assert.equal(f.state.fullName.value, '');
  const k = component('VirtualKeyboard.vue', f.context, f.api, { keyboardId: 'keyboard', assetSet: '0', disabled: false });
  k.state.press('language'); assert.equal(k.state.label('й'), 'й');
  k.state.press('shift'); k.state.press('й'); assert.equal(k.events[0].value, 'Й');
  k.exposed.reset(); assert.equal(k.state.language.value, 'en'); assert.equal(k.state.shift.value, false);
});

test('HTTP is blocked by default and allowed only by the explicit flag for sessions and authenticated catalog', async () => {
  for (const allowHttpSession of [undefined, false, 'true', true]) {
    let calls = 0;
    const rt = runtime({ config: { realSession: true, apiBaseUrl: 'http://api.example.test/api', allowHttpSession }, fetch: async () => { calls++; return response({ item: session('guest') }); } });
    if (allowHttpSession === true) {
      assert.equal((await rt.api.createPresentationSession({ mode: 'guest' })).mock, false);
      await rt.catalog.catalogRequest('favorites', { token }); assert.equal(calls, 2);
    } else {
      await assert.rejects(rt.api.createPresentationSession({ mode: 'guest' }), /HTTPS/);
      await assert.rejects(rt.catalog.catalogRequest('favorites', { token }), /HTTPS/); assert.equal(calls, 0);
    }
  }
});

test('invalid API payloads and absent/unsafe consent URL fail safely', async () => {
  for (const data of [{ item: { token } }, { item: { ...session(), client: undefined } }, { registrationRequired: true, phone: '+79990000000' }, { item: { ...session(), mode: 'guest' } }]) {
    const rt = runtime({ config: { realSession: true }, fetch: async () => response(data) });
    await assert.rejects(rt.api.createPresentationSession({ mode: 'manager', phone: phoneText }));
  }
  const rt = runtime();
  for (const consentUrl of ['', 'javascript:alert(1)', 'https://user:pass@example.test/legal']) { rt.context.window.IdelConfig.consentUrl = consentUrl; assert.equal(rt.api.sessionConsentUrl(), null); }
  rt.context.window.IdelConfig.consentUrl = 'https://example.test/consent'; assert.equal(rt.api.sessionConsentUrl(), 'https://example.test/consent');
  await assert.rejects(rt.api.registerPresentationSession({ phone: phoneText, lastName: 'Иванов', firstName: 'Иван', managerId: 'mock-manager-1', consent: false }), /согласие/);
  await assert.rejects(rt.api.registerPresentationSession({ phone: phoneText, lastName: 'Иванов', firstName: 'Иван', managerId: 'unknown', consent: true }), /менеджера/);
});
