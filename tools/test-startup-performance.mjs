import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const base = process.env.INKWAVE_URL || 'http://127.0.0.1:8492/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-gpu', '--autoplay-policy=no-user-gesture-required'], defaultViewport: {width:1280,height:720} });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
  page.on('console', m => { if(m.type() === 'error' && /THREE\.|WebGL|GL_INVALID/.test(m.text())) errors.push(m.text()); });
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'languages', {get: () => ['en-US']}));
  await page.goto(base + '?skipTitle&news=0', {waitUntil:'networkidle0'});
  await page.waitForFunction('window.__G?.menus?.current === "main"');
  const initial = await page.evaluate(() => ({quality:__inkwave.settings.quality, renderer:!!__G.renderer, images:performance.getEntriesByType('resource').filter(r => r.name.includes('/assets/stages/')).map(r => r.name.split('/').pop())}));
  assert.equal(initial.quality, 'medium'); assert.equal(initial.renderer, false);
  assert.deepEqual(initial.images, ['tidewater-day.webp']);
  console.log('Initial menu', initial);
  await page.click('[data-id="settings"]');
  await page.waitForSelector('[data-id="tab-video"]'); await page.click('[data-id="tab-video"]');
  await page.waitForFunction('Array.from(document.querySelectorAll(".iw-seg__opt")).some(b => b.textContent.trim() === "High")');
  await page.evaluate(() => Array.from(document.querySelectorAll('.iw-seg__opt')).find(b => b.textContent.trim() === 'High').click());
  assert.equal(await page.evaluate(() => __inkwave.settings.quality), 'high');
  assert.equal(await page.evaluate(() => !!__G.renderer), false);
  await page.reload({waitUntil:'networkidle0'});
  assert.equal(await page.evaluate(() => __inkwave.settings.quality), 'high');
  await page.evaluate(() => __G.menus.show('setup'));
  await new Promise(r => setTimeout(r,1000));
  const art = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/assets/stages/')).map(r => r.name.split('/').pop()));
  assert.ok(!art.some(n => n.startsWith('cargo-')));
  assert.ok(!art.some(n => /^(kelpline|halyard)-.*(?<!-sm)\.webp$/.test(n)));
  console.log('High persisted before renderer; setup image requests', art);
  // Verify the material optimization independently of quality reduction.
  const textures = await page.evaluate(async () => {
    const THREE = await import('three');
    const {createTextureLibrary} = await import('./src/world/texlib.js');
    const {STAGE_SURFACES} = await import('./src/world/stages/surfaces.js');
    const r = new THREE.WebGLRenderer();
    const full = await createTextureLibrary(r,{size:64});
    const selective = await createTextureLibrary(r,{size:64,stage:'tidewater'});
    const initialCount = selective.stats.generatedLayers;
    const commonIndex = selective.layers.concrete;
    const read = (lib, index, attachment) => {
      // WebGLArrayRenderTarget replaces attachment zero without preserving its
      // renderTarget pointer; texlib explicitly attaches it to the normal array.
      const target = lib.normal.renderTarget;
      if(!target?.isWebGLRenderTarget) throw new Error('Missing texture readback target');
      r.setRenderTarget(target,index);
      const pixels = new Uint8Array(64*64*4);
      r.readRenderTargetPixels(target,0,0,64,64,pixels,undefined,attachment);
      return pixels;
    };
    let mismatch = 0, emptyAttachments = 0;
    const compare = index => { for(let k=0;k<3;k++){const a=read(full,index,k),b=read(selective,index,k); if(!a.some(x=>x!==0))emptyAttachments++; for(let j=0;j<a.length;j++)if(a[j]!==b[j])mismatch++;} };
    compare(commonIndex);
    const stages=[...new Set(STAGE_SURFACES.map(s=>s.stage))];
    await Promise.all(stages.flatMap(stage=>[selective.ensureStage(stage),selective.ensureStage(stage)]));
    for (const surface of STAGE_SURFACES) compare(selective.layers[surface.name]);
    const count = selective.stats.generatedLayers;
    await selective.ensureStage('tidewater');
    const report = {expectedMissing:STAGE_SURFACES.filter(s=>s.stage!=='tidewater').length,initialCount,finalCount:count,total:selective.stats.totalLayers,mismatch,emptyAttachments,revisitCount:selective.stats.generatedLayers};
    r.setRenderTarget(null); full.dispose();selective.dispose();r.dispose();r.forceContextLoss();
    return report;
  });
  assert.equal(textures.total-textures.initialCount,textures.expectedMissing);
  assert.equal(textures.finalCount,textures.total);
  assert.equal(textures.revisitCount,textures.total);
  assert.equal(textures.mismatch,0);
  assert.equal(textures.emptyAttachments,0);
  assert.deepEqual(errors,[]);
  console.log('Selective material generation and concurrent/revisit requests',textures);
} finally { await browser.close(); }
