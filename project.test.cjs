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
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      const sections = Array.from({length:8}, (_, n) => ({id:n+1,target:`section-${n+1}`,name:`Секция ${n+1}`,description:[`Описание секции ${n+1}`,`Второй абзац ${n+1}`],sceneObjectKey:null}));
      const objects = [['business-center','Деловой центр'],['parking','Паркинг'],['storage','Кладовые']].map(([target,name],n) => ({id:100+n,chapter:'project',target,name,description:[`Описание ${name}`,`Второй абзац ${name}`],roomLabel:null,sceneObjectKey:null}));
      return route.fulfill({json:{items:url.pathname.endsWith('/sections')?sections:objects,meta:{total:url.pathname.endsWith('/sections')?sections.length:objects.length}},headers:{'Access-Control-Allow-Origin':'*'}});
    });
    await page.goto(base + '?view=location');
    await page.evaluate(() => {
      window.commands = [];
      window.addEventListener('idel-command', event => commands.push(event.detail));
    });
    await page.locator('[data-chapter="project"]').click();
    assert.equal(await page.locator('#project-description-title').textContent(), 'Секция 4');
    await page.locator('.project-target').nth(10).waitFor();
    assert.equal(await page.locator('.project-target').count(), 11);
    assert.deepEqual(await page.evaluate(() => ({ method: commands.at(-1).method, params: commands.at(-1).params })), { method: 'ui.selectChapter', params: { chapter: 'project' } });
    assert.equal(await page.locator('[data-chapter="project"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.chapter), 'project');
    const initialText = await page.locator('.project-description-text').textContent();
    for (const [id, label] of [
      ['section-1', 'Секция 1'], ['section-2', 'Секция 2'], ['section-3', 'Секция 3'],
      ['section-5', 'Секция 5'], ['section-6', 'Секция 6'], ['section-7', 'Секция 7'], ['section-8', 'Секция 8'], ['business-center', 'Деловой центр'],
      ['parking', 'Паркинг'], ['storage', 'Кладовые'],
    ]) {
      await page.locator(`[data-project-target="${id}"]`).click();
      assert.equal(await page.locator('#project-description-title').textContent(), label);
      assert.equal(await page.locator('.project-target[aria-pressed=true]').count(), 1);
      assert.equal(await page.locator('.project-description p').count(), 2);
      assert.deepEqual(await page.evaluate(() => ({ method: commands.at(-1).method, params: commands.at(-1).params })), { method: 'scene.selectProjectTarget', params: { target: id } });
    }
    assert.notEqual(await page.locator('.project-description-text').textContent(), initialText);
    const count = await page.evaluate(() => commands.length);
    await page.locator('[data-project-target="storage"]').click();
    assert.equal(await page.evaluate(() => commands.length), count, 'No duplicate selection event');
    await page.locator('[data-chapter="location"]').click();
    assert.equal(await page.locator('.project-description').count(), 0);
    assert.equal(await page.locator('.location-categories').isVisible(), true);
    await page.locator('[data-chapter="project"]').click();
    assert.equal(await page.locator('#project-description-title').textContent(), 'Кладовые');
    await page.locator('#visibility').click();
    assert.equal(await page.locator('.project-description').isVisible(), false);
    assert.equal(await page.locator('.project-controls').isVisible(), false);
    assert.equal(await page.locator('.location-background').isVisible(), true);
    await page.locator('#visibility').click();
    await page.locator('[data-action="ui.info"]').click();
    assert.equal(await page.locator('.project-view').count(), 0);
    assert.equal(await page.evaluate(() => IdelWidget.getState().view), 'home');
    await page.evaluate(() => {
      commands.length = 0;
      IdelWidget.setState({ view: 'project', projectTarget: 'section-2' });
      IdelWidget.setState({ view: 'invalid', projectTarget: 'unknown' });
    });
    assert.equal(await page.locator('#project-description-title').textContent(), 'Секция 2');
    assert.equal(await page.evaluate(() => commands.length), 0);
    await page.evaluate(() => IdelSession.reset());
    assert.equal(await page.locator('#welcome').isVisible(), true);
    assert.equal(await page.evaluate(() => IdelWidget.getState().projectTarget), 'section-4');

    await page.goto(base + '?view=project');
    for (const [width, height] of [[1920,1080], [3840,2160], [1440,900], [768,900], [375,900]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      const controls = await page.locator('.project-controls').boundingBox();
      const top = await page.locator('.top').boundingBox();
      assert.ok(controls.x >= 0 && controls.x + controls.width <= width && controls.y + controls.height <= height);
      assert.ok(top.x + top.width <= controls.x || top.y + top.height < controls.y, 'Description area must not overlap navigation');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const broken = await page.locator('#presentation img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).map(img => img.src));
      assert.deepEqual(broken, []);
      await page.locator('[data-project-target="storage"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#project-description-title').textContent(), 'Кладовые');
      await page.evaluate(() => {
        IdelWidget.setState({ projectTarget: 'section-4' });
        document.querySelector('.project-targets').scrollLeft = 0;
        document.querySelector('.top').scrollTop = 0;
        document.activeElement.blur();
      });
      await page.screenshot({ path: path.join(__dirname, `preview-project-${width}.png`) });
    }
    await page.goto(base + '?data=standalone&mode=unreal&view=project');
    assert.equal(await page.locator('#welcome').isVisible(), true);
    await page.locator('#start').click();
    await page.locator('#guest').click();
    await page.evaluate(() => IdelWidget.setState({ view: 'project', projectTarget: 'section-5' }));
    assert.equal(await page.locator('#project-description-title').textContent(), 'Секция 5');
    assert.equal(await page.locator('.location-preview').count(), 0);
    assert.equal(await page.locator('.location-pin').count(), 0);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.route('**/api/sections', route => route.fulfill({status:503,json:{error:{message:'Unavailable'}},headers:{'Access-Control-Allow-Origin':'*'}}));
    await page.goto(base + '?view=project');
    await page.getByText('Не удалось загрузить описание. Повторите попытку.').waitFor();
    assert.equal(await page.locator('.project-description-text').getByText('Описание секции 4').count(),0,'No mock description on API error');
    await page.unroute('**/api/sections');
    await page.getByRole('button',{name:'Повторить',exact:true}).click();
    await page.getByText('Описание секции 4').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: project navigation, all target descriptions, commands, state synchronization, reset, keyboard, five viewports and Unreal transparency.');
  } finally { await browser.close(); }
})();
