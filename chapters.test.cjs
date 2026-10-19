const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const chapters = {
  architecture: ['pilasters', [['arches', 'Арки'], ['columns', 'Колонны'], ['pilasters', 'Пелястры'], ['balconies', 'Балконы']]],
  park: ['bratva', [['square', 'Площадь'], ['bratva', 'Братва'], ['benches', 'Лавочки'], ['amphitheater', 'Амфитеатр'], ['chandelier', 'Люстра'], ['restaurant', 'Ресторан'], ['park', 'Парк'], ['business-center', 'Деловой центр']]],
  courtyard: ['fish-art', [['quiet-rest', 'Тихий отдых'], ['fish-art', 'Артобъект Рыбы'], ['flowerbed', 'Клумба'], ['outdoor-lounge', 'Уличная гостиная']]],
  entrance: ['playroom', [['grand-lobby', 'Гранд-Лобби'], ['playroom', 'Детская игровая'], ['gym', 'Спортзал']]],
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.addInitScript(() => { window.IdelConfig = { realSession: false }; });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = pathToFileURL(path.join(__dirname, 'index.html')).href;
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      const chapter = url.searchParams.get('chapter');
      const entries = chapters[chapter]?.[1] || [];
      const items = entries.map(([target,name],n) => ({id:1000+n,chapter,target,name,description:[`Описание ${name}`,`Второй абзац ${name}`],roomLabel:chapter==='entrance'?{'grand-lobby':'Помещение 2',playroom:'Помещение 1',gym:'Помещение 3'}[target]:null,sceneObjectKey:null}));
      return route.fulfill({json:{items,meta:{total:items.length}},headers:{'Access-Control-Allow-Origin':'*'}});
    });
    await page.goto(base + '?view=project');
    await page.evaluate(() => {
      window.commands = [];
      window.addEventListener('idel-command', event => commands.push(event.detail));
    });
    for (const [chapter, [initial, targets]] of Object.entries(chapters)) {
      await page.locator(`[data-chapter="${chapter}"]`).click();
      assert.deepEqual(await page.evaluate(() => ({ method: commands.at(-1).method, params: commands.at(-1).params })), { method: 'ui.selectChapter', params: { chapter } });
      assert.equal(await page.locator('[data-chapter-target][aria-pressed=true]').getAttribute('data-chapter-target'), initial);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.chapter), chapter);
      await page.locator('.project-target').nth(targets.length - 1).waitFor();
      assert.equal(await page.locator('.project-target').count(), targets.length);
      for (const [target, label] of targets) {
        const before = await page.evaluate(() => commands.length);
        const same = await page.locator(`[data-chapter-target="${target}"]`).getAttribute('aria-pressed') === 'true';
        await page.locator(`[data-chapter-target="${target}"]`).click();
        assert.equal(await page.locator('#project-description-title').textContent(), label);
        assert.equal(await page.locator('.project-description-text p').count(), 2);
        assert.equal(await page.locator('.project-target[aria-pressed=true]').count(), 1);
        assert.equal(await page.evaluate(() => commands.length), before + (same ? 0 : 1));
        if (!same) assert.deepEqual(await page.evaluate(() => ({ method: commands.at(-1).method, params: commands.at(-1).params })), { method: 'scene.selectChapterTarget', params: { chapter, target } });
      }
      if (chapter === 'entrance') {
        assert.equal(await page.locator('.project-description-room').textContent(), 'Помещение 3');
        await page.locator('[data-action="scene.requestInteriorView"]').click();
        assert.deepEqual(await page.evaluate(() => ({ method: commands.at(-1).method, params: commands.at(-1).params })), { method: 'scene.requestInteriorView', params: { target: 'gym' } });
      }
      const count = await page.evaluate(() => commands.length);
      await page.locator(`[data-chapter="${chapter}"]`).click();
      assert.equal(await page.evaluate(() => commands.length), count);
      await page.locator('#visibility').click();
      assert.equal(await page.locator('.project-controls').isVisible(), false);
      assert.equal(await page.locator('.project-description').isVisible(), false);
      await page.locator('#visibility').click();
      await page.locator('[data-chapter="location"]').click();
      await page.locator(`[data-chapter="${chapter}"]`).click();
      assert.equal(await page.locator('#project-description-title').textContent(), targets.at(-1)[1]);
    }
    await page.evaluate(() => {
      commands.length = 0;
      IdelWidget.setState({ view: 'architecture', chapterTargets: { architecture: 'columns', park: 'restaurant' } });
      IdelWidget.setState({ view: 'toString', chapterTargets: { architecture: 'gym', entrance: null, invalid: 'columns' } });
      const copy = IdelWidget.getState();
      copy.chapterTargets.architecture = 'arches';
    });
    assert.equal(await page.locator('#project-description-title').textContent(), 'Колонны');
    assert.equal(await page.evaluate(() => IdelWidget.getState().chapterTargets.park), 'restaurant');
    assert.equal(await page.evaluate(() => commands.length), 0);
    await page.locator('[data-action="ui.info"]').click();
    assert.equal(await page.locator('.project-view').count(), 0);
    await page.evaluate(() => IdelSession.reset());
    assert.deepEqual(await page.evaluate(() => IdelWidget.getState().chapterTargets), Object.fromEntries(Object.entries(chapters).map(([id, [initial]]) => [id, initial])));

    for (const [chapter, [initial, targets]] of Object.entries(chapters)) {
      await page.goto(base + '?view=' + chapter);
      for (const [width, height] of [[1920,1080], [3840,2160], [1440,900], [768,900], [375,900]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
        const controls = await page.locator('.project-controls').boundingBox();
        const top = await page.locator('.top').boundingBox();
        assert.ok(controls.x >= 0 && controls.x + controls.width <= width && controls.y + controls.height <= height, `${chapter} ${width}: navigation bounds`);
        assert.ok(top.x + top.width <= controls.x || top.y + top.height < controls.y, `${chapter} ${width}: description overlaps navigation`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const [lastTarget, label] = targets.at(-1);
        await page.locator(`[data-chapter-target="${lastTarget}"]`).focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#project-description-title').textContent(), label);
        const icons = await page.locator('.location-chapter-icon img').evaluateAll(images => images.map(img => ({ w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height })));
        assert.ok(icons.every(icon => icon.w === (width >= 2500 ? 36 : 18) && icon.h === icon.w));
        await page.evaluate(({ chapter, initial }) => {
          IdelWidget.setState({ chapterTargets: { [chapter]: initial } });
          document.querySelector('.project-targets').scrollLeft = 0;
          document.querySelector('.top').scrollTop = 0;
          document.activeElement.blur();
        }, { chapter, initial });
        await page.screenshot({ path: path.join(__dirname, `preview-${chapter}-${width}.png`) });
      }
    }
    await page.goto(base + '?data=standalone&mode=unreal&view=architecture');
    assert.equal(await page.locator('#welcome').isVisible(), true);
    await page.locator('#start').click();
    await page.locator('#guest').click();
    for (const chapter of Object.keys(chapters)) {
      await page.evaluate(chapter => IdelWidget.setState({ view: chapter }), chapter);
      assert.equal(await page.locator('.project-description').isVisible(), true);
      assert.equal(await page.locator('.location-preview').count(), 0);
      assert.equal(await page.locator('.location-pin').count(), 0);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: four chapters, all 19 objects, events, remembered choices, sync validation/no echo, reset, keyboard, five viewports, original assets and Unreal transparency.');
  } finally { await browser.close(); }
})();
