const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const widgetUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type,authorization' };
const token = 'a'.repeat(64);
const client = { id: 456, name: 'Иванов Иван Иванович' };
const manager = { id: 123, name: 'Тестовый менеджер' };
const sessionItem = mode => ({ token, expiresAt: '2030-01-01T00:00:00Z', mode, ...(mode === 'manager' ? { client, manager } : {}) });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const sent = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.IdelConfig = { apiBaseUrl: 'https://api.example.test/api', realSession: true }; });
    await page.route('https://api.example.test/api/**', route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (pathname === '/api/managers') return route.fulfill({ json: { items: [manager] }, headers: cors });
      if (pathname === '/api/session') {
        sent.push(JSON.parse(request.postData()));
        return route.fulfill({ status: 201, json: sent.at(-1).phone === '+79990000001' ? { registrationRequired: true, phone: '+79990000001' } : { item: sessionItem(sent.at(-1).mode) }, headers: cors });
      }
      if (pathname === '/api/session/register') { sent.push(JSON.parse(request.postData())); return route.fulfill({ status: 201, json: { item: sessionItem('manager') }, headers: cors }); }
      if (pathname === '/api/favorites') return route.fulfill({ json: { items: [], meta: { page: 1, total: 0, hasNext: false } }, headers: cors });
      return route.fulfill({ status: 404, json: { error: { message: 'Missing' } }, headers: cors });
    });
    await page.goto(widgetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.evaluate(() => { window.commands = []; window.addEventListener('idel-command', event => commands.push(event.detail)); });
    await page.locator('#start').click();
    await page.locator('#phone').fill('+7 (999) 123-45-67');
    assert.equal(await page.locator('#manager-toggle').count(), 0);
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.locator('#presentation').waitFor({ state: 'visible' });
    assert.deepEqual(sent[0], { mode: 'manager', phone: '+79991234567' });
    assert.equal(await page.evaluate(() => IdelSession.getState().mock), false);
    assert.equal(await page.evaluate(() => JSON.stringify(commands).includes('999')), false);
    assert.equal(await page.evaluate(value => JSON.stringify(commands).includes(value), token), false);
    assert.equal(await page.evaluate(value => JSON.stringify(IdelSession.getState()).includes(value), token), false);
    assert.equal(await page.evaluate(value => JSON.stringify(commands).includes(value), client.name), false);
    assert.deepEqual(await page.evaluate(() => IdelSession.getState().client), { id: 456 });
    await page.evaluate(() => IdelSession.reset());
    await page.locator('#start').click();
    await page.locator('#phone').fill('+7 (999) 000-00-01');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.locator('#fio').waitFor({ state: 'visible' });
    await page.locator('#fio').fill('Иванов-Петров Иван');
    await page.locator('#manager-toggle').click();
    await page.getByRole('button', { name: 'Тестовый менеджер', exact: true }).click();
    await page.locator('#session-consent').check();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.locator('#presentation').waitFor({ state: 'visible' });
    assert.deepEqual(sent[1], { mode: 'manager', phone: '+79990000001' });
    assert.deepEqual(sent[2], { phone: '+79990000001', lastName: 'Иванов-Петров', firstName: 'Иван', managerId: 123, consent: true });
    assert.equal(await page.evaluate(() => JSON.stringify(commands).includes('Иванов-Петров')), false);
    await page.evaluate(() => IdelSession.reset());
    await page.locator('#start').click();
    await page.locator('#guest').click();
    await page.locator('#presentation').waitFor({ state: 'visible' });
    assert.deepEqual(sent[3], { mode: 'guest' });
    assert.deepEqual(errors, []);
    await page.close();

    const insecure = await browser.newPage();
    let insecureRequests = 0;
    insecure.on('request', request => { if (request.url().startsWith('http://api.example.test')) insecureRequests++; });
    await insecure.addInitScript(() => { window.IdelConfig = { apiBaseUrl: 'http://api.example.test/api', realSession: true, allowHttpSession: false }; });
    await insecure.goto(widgetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await insecure.locator('#start').click();
    await insecure.locator('#guest').click();
    assert.ok((await insecure.locator('#session-error').innerText()).includes('HTTPS'));
    assert.equal(insecureRequests, 0);
    await insecure.close();

    const optedIn = await browser.newPage();
    await optedIn.addInitScript(() => { window.IdelConfig = { apiBaseUrl: 'http://api.example.test/api', realSession: true, allowHttpSession: true }; });
    await optedIn.route('http://api.example.test/api/**', route => route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: cors }) : route.fulfill({ json: { item: sessionItem('guest') }, headers: cors }));
    await optedIn.goto(widgetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await optedIn.locator('#start').click();
    await optedIn.locator('#guest').click();
    await optedIn.locator('#presentation').waitFor({ state: 'visible' });
    assert.equal(await optedIn.evaluate(() => IdelSession.getState().mock), false);
    await optedIn.close();
    console.log('PASS session API: phone lookup/register/guest, private DTO, strict HTTPS and explicit HTTP opt-in');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
