import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const base=process.env.INKWAVE_URL||'http://127.0.0.1:8490/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu'],defaultViewport:{width:1280,height:720}});
const report={};
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>Object.defineProperty(navigator,'languages',{get:()=>['en-US']}));
 await page.goto(base+'?skipTitle&news=0',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction('window.__G?.menus?.current==="main"',{timeout:180000});
 report.fresh=await page.evaluate(()=>({quality:__inkwave.settings.quality,attract:__G.match?.attract,actors:__G.match?.actors.length,showcase:!!__inkwave.showcase,backdrop:document.getElementById('app').classList.contains('is-menu-backdrop')}));
 assert.deepEqual(report.fresh,{quality:'high',attract:true,actors:8,showcase:true,backdrop:false});
 await page.click('[data-id="settings"]');
 report.mouseMusic=await page.evaluate(()=>({audio:__G.audio.ctx.state,track:__G.music.track}));assert.deepEqual(report.mouseMusic,{audio:'running',track:'menu'});
 report.quality=await page.evaluate(()=>{__inkwave.api.setSettings({quality:'low'});return {active:__inkwave.settings.quality,pending:__inkwave.pendingQuality??null,msaa:__inkwave.R.q.msaa};});assert.deepEqual(report.quality,{active:'low',pending:null,msaa:0});
 report.locker=await page.evaluate(()=>{__G.menus.show('locker');return {screen:__G.menus.current,showcase:__inkwave.showcase.mode};});assert.deepEqual(report.locker,{screen:'locker',showcase:'locker'});
 await page.evaluate(()=>__G.menus.show('main'));assert.ok(await page.evaluate(()=>__G.match.attract));
 await page.evaluate(()=>__G.menus.show('online'));assert.equal(await page.evaluate(()=>__inkwave.showcase.mode),'hub');
 await page.evaluate(async()=>{await __G.net.create('parity-test');__G.menus.show('lobby');});
 await page.waitForFunction('__inkwave.showcase.mode==="lobby"',{timeout:20000});
 report.lobby=await page.evaluate(()=>({mode:__inkwave.showcase.mode,state:__G.net.state}));
 await page.evaluate(()=>__G.net.leave());assert.deepEqual(errors,[]);await page.close();
 const fallback=await browser.newPage();await fallback.setRequestInterception(true);fallback.on('request',r=>r.url().includes('/assets/lightmaps/tidewater.json')?r.abort('failed'):r.continue());
 await fallback.evaluateOnNewDocument(()=>localStorage.setItem('inkwave.settings',JSON.stringify({quality:'low'})));
 await fallback.goto(base+'?skipTitle&news=0',{waitUntil:'domcontentloaded',timeout:180000});await fallback.waitForFunction('window.__G?.menus?.current==="main"',{timeout:180000});
 report.optionalLightmapFailure=await fallback.evaluate(()=>({screen:__G.menus.current,attract:__G.match.attract,actors:__G.match.actors.length}));assert.deepEqual(report.optionalLightmapFailure,{screen:'main',attract:true,actors:8});
 console.log(JSON.stringify(report));
}finally{await browser.close();}
