const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'chrome'});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.IdelConfig = { realSession: false }; });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = pathToFileURL(path.join(__dirname, 'index.html')).href;
    for (const [panel, width, height, selector, action, method] of [
      ['environment',297,312,'.top','[data-season="winter"]','scene.setSeason'],
      ['toolbar',294,106,'.bottom','[data-action="scene.home"]','scene.home'],
      ['compass',56,64,'.compass','.compass','scene.resetNorth'],
    ]) {
      await page.setViewportSize({width,height});
      await page.goto(base + '?mode=unreal&panel=' + panel,{timeout:90000});
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.addEventListener('idel-command', event => window.lastCommand = event.detail));
      assert.equal(await page.locator('#welcome').isVisible(),false);
      assert.equal(await page.locator(selector).isVisible(),true);
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x+box.width <= width && box.y+box.height <= height, JSON.stringify(box));
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
      await page.locator(action).click();
      assert.equal(await page.evaluate(() => lastCommand.method),method);
      if (panel === 'environment') {
        await page.evaluate(() => {
          window.timeCommands = [];
          window.addEventListener('idel-command', event => {
            if (event.detail.method === 'scene.setTime') window.timeCommands.push(event.detail);
          });
        });
        const slider = await page.locator('#time').boundingBox();
        await page.mouse.move(slider.x + slider.width * .3, slider.y + slider.height / 2);
        await page.mouse.down();
        await page.mouse.move(slider.x + slider.width * .7, slider.y + slider.height / 2, {steps: 8});
        const commands = await page.evaluate(() => window.timeCommands);
        assert.ok(commands.length > 1, 'Time commands must arrive before mouse release');
        for (const command of commands) {
          assert.equal(command.params.hours, command.params.minutes / 60);
        }
        await page.mouse.up();
        assert.equal(await page.evaluate(() => window.timeCommands.length), commands.length, 'Release must not duplicate the last command');
      }
      await page.screenshot({path:path.join(__dirname,`preview-panel-${panel}.png`)});
    }
    await page.setViewportSize({width:1920,height:1080});
    await page.goto(base+'?mode=unreal&panel=session',{timeout:90000});
    await page.locator('#start').click();
    await page.locator('#guest').click();
    assert.equal(await page.locator('#presentation').isVisible(),false);
    assert.equal(await page.evaluate(() => IdelSession.getState().mode),'guest');
    await page.evaluate(() => IdelSession.reset());
    assert.equal(await page.locator('#welcome').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: isolated panels, bounds, transparency, commands, session-only entry/reset.');
  } finally { await browser.close(); }
})();
