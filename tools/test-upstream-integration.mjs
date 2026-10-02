// Exercise the integration boundaries: mode-specific worlds, live loadouts and reactive localized UI.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.INKWAVE_URL||'http://127.0.0.1:8490/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1440,height:900},protocolTimeout:240000});
const errors=[],report=[];mkdirSync('.local/upstream-integration',{recursive:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>localStorage.setItem('inkwave.settings',JSON.stringify({quality:'low',language:'en'})));
 await page.goto(base+'?skipTitle&news=0',{waitUntil:'networkidle0'});
 await page.waitForFunction('!!window.__inkwave?.api');
 const counts=await page.evaluate(()=>({weapons:__inkwave.api.weaponOrder.length,subs:__inkwave.api.subOrder.length,specials:__inkwave.api.specialOrder.length}));
 assert.deepEqual(counts,{weapons:12,subs:15,specials:19});
 // All newly available stages and their mode-specific lightmaps must actually build and enter play.
 for(const map of (process.argv.includes('--ui-only')?[]:['tidewater','saltpan','crossmarket','terraces','lockgate','halyard','kelpline'])){
  for(const mode of ['turf','zones']){
   await page.evaluate(({map,mode})=>{window.pending=__inkwave.startMatch({mapId:map,mode,duration:60});},{map,mode});
   await page.evaluate(()=>window.pending);
   await page.waitForFunction('__G.match?.state==="playing"',{timeout:180000});
   const state=await page.evaluate(()=>({map:__inkwave.mapDef.id,key:__inkwave.worldKey,mode:__G.match.mode,zones:!!__G.match.zones,screen:__G.menus.current,loading:__inkwave._loadingMatch}));
   assert.equal(state.map,map);assert.equal(state.mode,mode);assert.equal(state.zones,mode==='zones');assert.equal(state.loading,false);assert.equal(state.screen,null);
   if(mode==='zones'&&['tidewater','saltpan','crossmarket','terraces','halyard'].includes(map))assert.equal(state.key,map+'.zones');
   report.push(state);console.log('world',JSON.stringify(state));
   if(map==='crossmarket'&&mode==='zones')await page.screenshot({path:'.local/upstream-integration/crossmarket-zones.png'});
  }
 }
 await page.evaluate(()=>__inkwave.startPractice({mapId:'saltpan'}));
 assert.equal(await page.evaluate(()=>__inkwave.api.isPractice()),true);
 const kits=await page.evaluate(async()=>{
  const game=__inkwave,api=game.api,m=game.match,actor=m.local,results=[];
  for(let i=0;i<Math.max(api.weaponOrder.length,api.subOrder.length,api.specialOrder.length);i++){
   const kit={weapon:api.weaponOrder[i%api.weaponOrder.length],sub:api.subOrder[i%api.subOrder.length],special:api.specialOrder[i%api.specialOrder.length]};
   api.setLoadout(kit);await new Promise(r=>requestAnimationFrame(r));
   results.push({expected:kit,actual:{weapon:actor.weaponId,sub:actor.subId,special:actor.specialId},sameMatch:m===game.match,full:actor.special===actor.specialCost()});
  }
  return results;
 });
 for(const k of kits){assert.deepEqual(k.actual,k.expected);assert.ok(k.sameMatch&&k.full);}
 // Open/refresh all new screens in each locale and preserve an already-running practice session.
 for(const lang of ['en','zh-Hans','zh-Hant','ja']){
  const checks=await page.evaluate(async lang=>{
   const {translate}=await import('./src/i18n/runtime.js'),game=__inkwave,m=game.match,actor=m.local;
   game.api.setSettings({language:lang});game.menus.show('howto');
   game.menus._scr.el.querySelector('[data-value="zones"]')?.click();
   const rules=game.menus._scr.el.innerText;
   game.menus.show('loadout');const loadout=game.menus._scr.el.innerText;
   game.pause();const pause=game.menus._scr.el.innerText;
   return{same:game.match===m&&game.match.local===actor,practice:game.hud.timerTxt.textContent===translate('PRACTICE'),rules:rules.includes(translate('HOW TO PLAY')),loadout:loadout.includes(translate('SUB')),pause:pause.includes(translate('PRACTICE'))};
  },lang);
  assert.ok(Object.values(checks).every(Boolean),JSON.stringify({lang,checks}));
  await new Promise(r=>setTimeout(r,750));
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`.local/upstream-integration/${lang}-practice.png`});
  await page.evaluate(()=>__inkwave.resume());
 }
 assert.deepEqual(errors,[]);
 writeFileSync('.local/upstream-integration/'+(process.argv.includes('--ui-only')?'ui-report.json':'report.json'),JSON.stringify({counts,worlds:report,kits:kits.length,languages:4,errors},null,2));
 console.log('Integration passed',counts,'worlds',report.length,'kits',kits.length,'languages',4);
}finally{await browser.close();}
