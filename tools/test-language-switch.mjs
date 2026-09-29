import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.INKWAVE_URL || 'http://127.0.0.1:8490/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1440,height:900}});
const errors=[],results=[];mkdirSync('.local/native-i18n',{recursive:true});
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(()=>{Object.defineProperty(navigator,'languages',{get:()=>['zh-CN','en']});if(!localStorage.getItem('inkwave.settings'))localStorage.setItem('inkwave.settings',JSON.stringify({quality:'low'}));});
 await page.goto(base+'?skipTitle&news=0',{waitUntil:'networkidle0',timeout:120000});
 await page.waitForFunction('window.__G?.menus?.current === "main"',{timeout:120000});
 await page.evaluate(()=>{window.gameBeforeSwitch=__G;window.rendererBeforeSwitch=__G.renderer;__G.menus.show('settings');});
 const before=await page.evaluate(()=>performance.timeOrigin);
 for(const [index,lang,label] of [[1,'en','SETTINGS'],[2,'zh-Hans','设置'],[3,'zh-Hant','設定'],[4,'ja','設定'],[2,'zh-Hans','设置']]){
  await page.click(`[data-id="set-language"] .iw-seg__opt:nth-of-type(${index+2})`);
  await page.waitForFunction(code=>document.documentElement.lang===code,{timeout:10000},lang);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>performance.timeOrigin),before,'page reloaded');
  assert.ok(await page.evaluate(()=>window.gameBeforeSwitch===__G),'game replaced');
  const state=await page.evaluate(()=>({text:document.body.innerText,screen:__G.menus.current,preference:JSON.parse(localStorage.getItem('inkwave.settings')).language,focus:__G.menus._focus?.dataset.id,oldSelector:!!document.querySelector('.iw-language')}));
  assert.equal(state.screen,'settings');assert.equal(state.preference,lang);assert.ok(state.text.includes(label));assert.equal(state.oldSelector,false);
  assert.equal(state.focus,'set-language');
  if(lang!=='en') {
    const region={'zh-Hans':'SC','zh-Hant':'TC',ja:'JP'}[lang];
    const faces=await page.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family));
    assert.ok(faces.some(f=>f.includes('Swei '+region+' Display')),lang+' display font not loaded');
    assert.ok(faces.some(f=>f.includes('Swei '+region)&&!f.includes('Display')),lang+' body font not loaded');
  }
  await page.screenshot({path:`.local/native-i18n/${lang}-settings.png`});results.push({lang,focus:state.focus});
 }
 // The same focused row must respond to the engine's keyboard/gamepad navigation path.
 await page.evaluate(()=>__G.menus.nav('right'));
 await page.waitForFunction(()=>document.documentElement.lang==='zh-Hant');
 await page.evaluate(()=>__G.menus.nav('left'));
 await page.waitForFunction(()=>document.documentElement.lang==='zh-Hans');
 await page.setViewport({width:960,height:540});
 await new Promise(ok=>setTimeout(ok,400));
 assert.ok(await page.evaluate(()=>{const el=document.querySelector('.iw-row--language .iw-seg');return el.scrollWidth<=el.clientWidth+1;}),'language row overflows at 960x540');
 await page.screenshot({path:'.local/native-i18n/zh-Hans-settings-960.png'});
 await page.reload({waitUntil:'networkidle0',timeout:120000});
 await page.waitForFunction('window.__G?.menus?.current === "main"',{timeout:120000});
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'zh-Hans');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({results,errors,noReload:true,keyboardNavigation:true,persisted:true}));
} catch(e) {console.log(JSON.stringify({errors}));throw e;} finally {await browser.close();}
