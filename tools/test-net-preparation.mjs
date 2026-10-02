import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], defaultViewport: { width: 800, height: 600 } });
const pages = [], errors = [];
try {
  for (let i = 0; i < 3; i++) {
    const context = await browser.createBrowserContext(), page = await context.newPage(); pages.push(page);
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluateOnNewDocument(() => localStorage.setItem('inkwave.settings', JSON.stringify({ quality: 'low' })));
    await page.goto((process.env.INKWAVE_URL || 'http://127.0.0.1:8492/') + '?skipTitle&news=0&autopilot');
    await page.waitForFunction('!!window.__G?.net');
  }
  const code = await pages[0].evaluate(() => __G.net.create('Host'));
  for (let i = 1; i < 3; i++) await pages[i].evaluate(c => __G.net.join(c, 'Guest'), code);
  await pages[0].waitForFunction('__G.net.lobby.players.length === 3');
  const slow = await pages[2].evaluate(() => {
    // Simulate an unresolved dependency, without consuming additional GPU work.
    __G.net.on('error', () => setTimeout(() => { window.preparationErrorUI = document.body.innerText; }, 200));
    __G.game.startNetMatch = () => new Promise(() => {});
    return __G.net.myId;
  });
  for (let i = 1; i < 3; i++) await pages[i].evaluate(() => __G.net.setMe({ ready: true }));
  await pages[0].waitForFunction('__G.net.canStart()');
  await pages[0].evaluate(() => { __G.net.start(); __G.net._preparation.graceMs = 1000; });
  for (const page of pages.slice(0, 2)) await page.waitForFunction('__G.net.state === "match" && __G.match?.state === "playing"', { timeout: 180000 });
  await pages[2].waitForFunction('__G.net.state === "error"');
  const views = await Promise.all(pages.slice(0, 2).map(p => p.evaluate(id => ({
    state: __G.net.state, excluded: __G.net._excluded.has(id),
    owners: __G.match.actors.map(a => [a.nid, a.owner]).sort((a,b) => a[0]-b[0]),
    staleOwner: __G.match.actors.some(a => a.owner === id),
  }), slow)));
  assert.ok(views.every(v => v.excluded && !v.staleOwner));
  assert.deepEqual(views[0].owners, views[1].owners);
  assert.equal(await pages[2].evaluate(() => __G.net.error), 'Loading took too long. This match started without you.');
  assert.equal(await pages[2].evaluate(async () => window.preparationErrorUI?.includes((await import('./src/i18n/runtime.js')).translate(__G.net.error))), true);
  assert.deepEqual(errors, []);
  console.log('Two ready clients play; timed-out guest excluded; ownership agrees', views);
} finally { await browser.close(); }
