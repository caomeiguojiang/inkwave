import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--enable-gpu'], defaultViewport: { width: 960, height: 540 },
});
const errors = [], results = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => localStorage.setItem('inkwave.settings', JSON.stringify({ quality: 'low', language: 'en' })));
  await page.goto((process.env.INKWAVE_URL || 'http://127.0.0.1:8490/') + '?skipTitle&news=0', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__G?.menus?.current === "main"', { timeout: 180000 });
  await page.evaluate(async () => {
    await __inkwave.startMatch({ mapId: 'tidewater', mode: 'turf', duration: 180 });
    const input = __inkwave.input, lock = input.requestLock.bind(input);
    window.lockAttempts = 0;
    input.requestLock = () => { window.lockAttempts++; lock(); };
  });
  await page.waitForFunction('__G.match?.state === "playing"', { timeout: 60000 });
  // Model a refused resume: the game runs with no pointer lock and no special map-focus flag.
  for (const state of ['intro', 'playing']) {
    await page.evaluate(async state => {
      document.exitPointerLock();
      await new Promise(r => setTimeout(r, 100));
      __G.match.state = state; __G.match.paused = false;
      __G.menus.show(null); __inkwave._relock = false;
      window.lockAttempts = 0;
    }, state);
    await new Promise(r => setTimeout(r, 1200));
    await page.mouse.click(480, 270);
    await page.waitForFunction('document.pointerLockElement === __inkwave.R.renderer.domElement');
    const result = await page.evaluate(() => ({ attempts: lockAttempts, fired: __inkwave.input.mouse.leftPressed }));
    assert.ok(result.attempts > 0, state);
    assert.equal(result.fired, false, 'relocking must not also fire');
    results.push({ state, locked: true });
  }
  await page.evaluate(async () => { document.exitPointerLock(); await new Promise(r => setTimeout(r, 100)); });
  for (const [state, paused, menu] of [['playing', true, null], ['playing', false, 'settings'], ['judge', false, null], ['results', false, null]]) {
    const attempts = await page.evaluate(({ state, paused, menu }) => {
      __G.match.state = state; __G.match.paused = paused; __G.menus.show(menu);
      __inkwave._relock = false; window.lockAttempts = 0;
      __inkwave.R.renderer.domElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      return lockAttempts;
    }, { state, paused, menu });
    assert.equal(attempts, 0, `${state}/${paused}/${menu}`);
    results.push({ state, paused, menu, attempts });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }));
} finally { await browser.close(); }
