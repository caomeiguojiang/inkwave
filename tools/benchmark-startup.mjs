// Fresh browser process per run. CPU throttle is not a substitute for a weak GPU.
import puppeteer from 'puppeteer-core';
import {mkdirSync,writeFileSync} from 'node:fs';
const option=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1];};
const name=option('name','startup'), url=option('url','http://127.0.0.1:8492/');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1280,height:720}});
const errors=[];
try {
  const page=await browser.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(()=>{window.startupLongTasks=[];new PerformanceObserver(l=>startupLongTasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});});
  const cdp=await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(option('cpu',1))});
  await page.goto(url+'?skipTitle&news=0',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction('window.__G?.menus?.current === "main" && window.__inkwave',{timeout:180000});
  const menu=await page.evaluate(()=>({time:performance.now(),boot:__inkwave.bootMs,marks:__inkwave.bootMarks,renderer:!!__G.renderer,texture:__inkwave.texlib?.stats}));
  const clickStart=Date.now(); await page.click('[data-id="settings"]');
  await page.waitForFunction('__G.menus.current === "settings"');
  const settingsClickMs=Date.now()-clickStart;
  if(process.argv.includes('--preview')){
    await page.evaluate(()=>__G.menus.show('locker'));
    await page.waitForFunction('__inkwave.worldReady && __G.menus.current === "locker" && __inkwave.showcase?.mode === "locker"',{timeout:180000});
    await page.evaluate(()=>__inkwave.api.toMainMenu());
    await page.waitForFunction('__G.menus.current === "main"',{timeout:30000});
  }
  if(process.argv.includes('--start')){
    await page.evaluate(()=>{window.matchRequestedAt=performance.now();__inkwave.startMatch({mapId:'tidewater',duration:60});});
    await page.waitForFunction('__G.match?.state === "playing" && !__G.match.attract',{timeout:180000});
    await page.evaluate(()=>{window.playingObservedAt=performance.now();});
    await new Promise(r=>setTimeout(r,2500));
  }
  const result=await page.evaluate(()=>({marks:__inkwave.bootMarks,texture:__inkwave.texlib?.stats,matchRequestedAt:window.matchRequestedAt,playingObservedAt:window.playingObservedAt,now:performance.now(),state:__G.match?.state,longTasks:startupLongTasks,resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.transferSize,ms:r.duration})),programs:__G.renderer?.info.programs.length,gpu:(()=>{const gl=__G.renderer?.getContext(),e=gl?.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null;})()}));
  mkdirSync('.local/startup',{recursive:true}); await page.screenshot({path:'.local/startup/'+name+'.png'});
  const report={menu,settingsClickMs,...result,errors};writeFileSync('.local/startup/'+name+'.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,resources:{count:result.resources.length,bytes:result.resources.reduce((n,r)=>n+r.bytes,0)},longTasks:{count:result.longTasks.length,max:Math.max(0,...result.longTasks.map(t=>t.ms))}}));
  if(errors.length)process.exitCode=1;
}finally{await browser.close();}
