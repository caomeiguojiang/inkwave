import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const base=process.env.INKWAVE_URL || 'http://127.0.0.1:8492/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1280,height:720}});
try {
 const page=await browser.newPage(), errors=[];
 page.on('pageerror', e=>{errors.push(e.message);console.error(e.message);});
 page.on('console', m=>{if(m.type()==='error' && /THREE\.|WebGL|GL_INVALID/.test(m.text()))errors.push(m.text());});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('inkwave.settings',JSON.stringify({quality:'high'})));
 await page.goto(base+'?skipTitle&news=0',{waitUntil:'networkidle0'});
 await page.evaluate(()=>{window.startResult=__inkwave.startMatch({mapId:'tidewater',duration:120});});
 await page.waitForFunction('__G.match?.state === "playing"',{timeout:180000});
 await page.evaluate(()=>__inkwave.pause());
 await new Promise(r=>setTimeout(r,1500));
 const toggles=await page.evaluate(async()=>{
   const game=__inkwave, composer=game.R.composer, before={...__G.renderer.info.memory}, runs=[];
   for(const patch of [{shadows:false},{shadows:true},{bloom:false},{bloom:true},{shadows:false},{shadows:true}]){
     let running=true,last=performance.now(),maxGap=0;
     const tick=t=>{maxGap=Math.max(maxGap,t-last);last=t;if(running)requestAnimationFrame(tick);};requestAnimationFrame(tick);
     const t=performance.now();game.api.setSettings(patch);const applyMs=performance.now()-t;
     await new Promise(r=>setTimeout(r,500));running=false;
     runs.push({patch,applyMs,maxGap,sameComposer:composer===game.R.composer,shadowIntensity:__G.env.sun.shadow.intensity,shadowAutoUpdate:__G.env.sun.shadow.autoUpdate,textures:__G.renderer.info.memory.textures});
   }
   return{before,after:{...__G.renderer.info.memory},runs};
 });
 for(const run of toggles.runs){assert.ok(run.sameComposer);if('shadows'in run.patch){assert.equal(run.shadowIntensity,run.patch.shadows?1:0);assert.equal(run.shadowAutoUpdate,run.patch.shadows);}}
 assert.ok(toggles.after.textures<=toggles.before.textures+2,JSON.stringify(toggles));
 console.log('Toggle responsiveness/resources',JSON.stringify(toggles));
 // Last selection wins; a live world's heavyweight resources do not rebuild in the click handler.
 const deferred=await page.evaluate(()=>{
   const game=__inkwave,composer=game.R.composer;
   game.api.setSettings({quality:'low'});game.api.setSettings({quality:'high'});game.api.setSettings({quality:'medium'});
   return{display:game.api.getSettings().quality,active:game.settings.quality,sameComposer:game.R.composer===composer};
 });
 assert.deepEqual(deferred,{display:'medium',active:'high',sameComposer:true});
 // A deliberately blocked character preparation must not time out into play after 8 seconds.
 await page.evaluate(()=>{
   const proto=__inkwave.CharacterClass.prototype,original=proto.warmAll;
   let once=false;
   proto.warmAll=async function(...args){if(!once){once=true;window.warmBlocked=true;await new Promise(r=>window.releaseWarm=r);}return original.apply(this,args);};
   window.nextMatch=__inkwave.startMatch({mapId:'kelpline',duration:120});
   window.sameStartPromise=window.nextMatch===__inkwave.startMatch({mapId:'halyard',duration:120});
 });
 await page.waitForFunction('window.warmBlocked',{timeout:180000});
 await new Promise(r=>setTimeout(r,9000));
 const waiting=await page.evaluate(()=>({state:__G.match.state,screen:__G.menus.current,duplicateCoalesced:sameStartPromise}));
 assert.equal(waiting.state,'init');assert.equal(waiting.screen,'loading');assert.ok(waiting.duplicateCoalesced);
 await page.evaluate(()=>window.releaseWarm());
 await page.waitForFunction('__G.match?.state === "playing" && !__inkwave._starting',{timeout:120000});
 const applied=await page.evaluate(()=>({quality:__inkwave.settings.quality,map:__inkwave.mapDef.id,textureSize:__inkwave.texlib.size,shadowSize:__G.env.sun.shadow.mapSize.x,paintSize:__G.paint.size,fx:__G.fx.q,msaa:__inkwave.R.q.msaa}));
 assert.equal(applied.quality,'medium');assert.equal(applied.map,'kelpline');assert.equal(applied.textureSize,256);assert.equal(applied.shadowSize,2048);assert.equal(applied.fx,0.7);assert.equal(applied.msaa,2);
 console.log('Delayed warm-up gate and consistent quality/map',waiting,applied);
 // Cancelling a prepared-world load cannot enter play later or poison future loads.
 await page.evaluate(()=>{
   const proto=__inkwave.CharacterClass.prototype,original=proto.warmAll;
   let once=false;
   proto.warmAll=async function(...args){if(!once){once=true;window.cancelBlocked=true;await new Promise(r=>window.releaseCancel=r);}return original.apply(this,args);};
   window.cancelledStart=__inkwave.startMatch({mapId:'kelpline'});
 });
 await page.waitForFunction('window.cancelBlocked',{timeout:120000});
 await page.evaluate(async()=>{await __inkwave.quitToMenu();releaseCancel();});
 const cancelled=await page.evaluate(async()=>({result:await cancelledStart,failed:!!__inkwave._loadFailure,mode:__G.mode,screen:__G.menus.current}));
 assert.deepEqual(cancelled,{result:false,failed:false,mode:'menu',screen:'main'});
 console.log('Cancelled preparation',cancelled);
 assert.deepEqual(errors,[]);
 await page.close();
 // Network failure must produce a visible error and never start a partial match.
 const bad=await browser.newPage();await bad.setRequestInterception(true);
 bad.on('request',r=>r.url().includes('/assets/lightmaps/tidewater.json')?r.abort('failed'):r.continue());
 await bad.goto(base+'?skipTitle&news=0',{waitUntil:'networkidle0'});
 await bad.evaluate(()=>{window.failedStart=__inkwave.startMatch({mapId:'tidewater'});});
 await bad.waitForFunction('!!__inkwave._loadFailure',{timeout:180000});
 const failure=await bad.evaluate(async()=>({result:await failedStart,playing:__G.match?.state==='playing',error:document.getElementById('boot-error').textContent,visible:getComputedStyle(document.getElementById('boot-error')).display!=='none'}));
 assert.equal(failure.result,false);assert.equal(failure.playing,false);assert.ok(failure.visible);assert.match(failure.error,/lightmap/i);
 console.log('Failed dependency blocks entry',failure);
}finally{await browser.close();}
