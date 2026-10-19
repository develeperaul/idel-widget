const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.addInitScript(() => { window.IdelConfig = { realSession: false }; });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = pathToFileURL(path.join(__dirname, 'index.html')).href;
    await page.goto(base, { timeout: 90000 });
    await page.locator('#start').click();
    await page.locator('#guest').click();
    await page.locator('[data-action="ui.info"]').click();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.location-view').isVisible(), true);
    assert.equal(await page.locator('.location-pin').count(), 0, 'Scene markers belong to Unreal');
    await page.evaluate(() => {
      window.commands = [];
      window.addEventListener('idel-command', event => commands.push(event.detail));
    });
    await page.locator('[data-category="cafe"]').click();
    assert.equal(await page.locator('[data-category="cafe"]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => commands.at(-1).method), 'scene.setInfrastructure');
    assert.equal(await page.evaluate(() => commands.at(-1).params.categories.includes('cafe')), false);
    await page.locator('[data-category="cafe"]').click();
    assert.equal(await page.evaluate(() => commands.at(-1).params.categories.includes('cafe')), true);
    await page.locator('#visibility').click();
    assert.equal(await page.locator('.location-controls').isVisible(), false);
    assert.equal(await page.locator('.location-background').isVisible(), true);
    await page.locator('#visibility').click();
    await page.locator('[data-action="scene.home"]').click();
    assert.equal(await page.locator('.location-view').count(), 0);
    assert.equal(await page.evaluate(() => commands.at(-1).method), 'scene.home');
    await page.evaluate(() => {
      commands.length = 0;
      IdelWidget.setState({ view: 'location', categories: ['school', 'invalid'] });
      const snapshot = IdelWidget.getState();
      snapshot.categories.length = 0;
    });
    assert.deepEqual(await page.evaluate(() => IdelWidget.getState().categories), ['school']);
    assert.equal(await page.locator('.location-category[aria-pressed=true]').count(), 1);
    assert.equal(await page.evaluate(() => commands.length), 0, 'State synchronization must not echo commands');
    await page.evaluate(() => IdelSession.reset());
    assert.equal(await page.locator('#welcome').isVisible(), true);
    assert.equal(await page.evaluate(() => IdelWidget.getState().view), 'home');
    assert.equal(await page.evaluate(() => IdelWidget.getState().categories.length), 9);

    await page.goto(base + '?view=location', { timeout: 90000 });
    for (const [width, height] of [[1920, 1080], [3840, 2160], [1440, 900], [768, 900], [375, 900]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      const controls = await page.locator('.location-controls').boundingBox();
      assert.ok(controls.x >= 0 && controls.y >= 0 && controls.x + controls.width <= width && controls.y + controls.height <= height, JSON.stringify(controls));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const invalidAssets = await page.locator('.location-view img').evaluateAll(images => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src));
      assert.deepEqual(invalidAssets, []);
      await page.locator('[data-category="bus"]').focus();
      await page.keyboard.press('Space');
      assert.equal(await page.locator('[data-category="bus"]').getAttribute('aria-pressed'), 'false');
      await page.keyboard.press('Space');
      await page.locator('.location-categories').evaluate(el => { el.scrollLeft = 0; });
      await page.evaluate(() => document.activeElement.blur());
      await page.screenshot({ path: path.join(__dirname, `preview-location-${width}.png`) });
    }
    await page.goto(base + '?data=standalone&mode=unreal', { timeout: 90000 });
    await page.locator('#start').click();
    await page.locator('#guest').click();
    await page.locator('[data-action="ui.info"]').click();
    assert.equal(await page.locator('.location-preview').count(), 0);
    assert.equal(await page.locator('.location-controls').isVisible(), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.deepEqual(errors, []);
    console.log('PASS: location navigation, filter commands, visibility, state sync, five viewports, local assets and Unreal transparency.');
  } finally { await browser.close(); }
})();
