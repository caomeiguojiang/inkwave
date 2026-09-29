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
 await page.evaluate(()=>{window.gameBeforeSwitch=__G.game;window.rendererBeforeSwitch=__G.game.R;__G.menus.show('settings');});
 const before=await page.evaluate(()=>performance.timeOrigin);
 for(const [index,lang,label] of [[1,'en','SETTINGS'],[2,'zh-Hans','设置'],[3,'zh-Hant','設定'],[4,'ja','設定'],[2,'zh-Hans','设置']]){
  await page.click('[data-id="set-language"]');
  await page.click(`.iw-select__option[data-value="${lang}"]`);
  await page.waitForFunction(code=>document.documentElement.lang===code,{timeout:10000},lang);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>performance.timeOrigin),before,'page reloaded');
  assert.ok(await page.evaluate(()=>window.gameBeforeSwitch===__G.game&&window.rendererBeforeSwitch===__G.game.R),'game replaced');
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
 // Traverse the real keyboard route across rows and category tabs.
 const focusId=()=>page.evaluate(()=>__G.menus._focus?.dataset.id);
 await page.keyboard.press('ArrowDown'); assert.equal(await focusId(),'reset');
 await page.keyboard.press('ArrowUp'); assert.equal(await focusId(),'set-language');
 await page.keyboard.press('ArrowUp'); assert.equal(await focusId(),'tab-general');
 await page.keyboard.press('e'); assert.equal(await focusId(),'tab-controls');
 await page.keyboard.press('ArrowDown'); assert.equal(await focusId(),'set-sensitivity');
 await page.keyboard.press('q'); assert.equal(await focusId(),'set-language');
 for(const tab of ['video','audio','gameplay','general']) {
   const selector='[data-id="tab-'+tab+'"]';
   await page.click(selector);
   await page.keyboard.press('ArrowDown');
   assert.ok((await focusId()).startsWith('set-'),'tab must lead to its settings row');
 }
 await page.hover('.iw-select');
 await new Promise(ok=>setTimeout(ok,500));
 await page.screenshot({path:'.local/native-i18n/language-emboss-hover.png'});
 await page.mouse.down();
 await page.screenshot({path:'.local/native-i18n/language-emboss-pressed.png'});
 await page.mouse.up();
 await page.hover('.iw-select__option[data-value="ja"]');
 assert.equal(await focusId(),'language-ja','pointer hover must move the game cursor');
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'zh-Hans');
 assert.equal(await page.$eval('[aria-selected="true"]',e=>e.dataset.value),'zh-Hans');
 await new Promise(ok=>setTimeout(ok,500));
 await page.screenshot({path:'.local/native-i18n/language-emboss-browse.png'});
 await page.keyboard.press('e'); assert.equal(await focusId(),'language-ja','category shortcut must not escape open list');
 await page.keyboard.press('ArrowDown'); assert.equal(await focusId(),'language-ja','last option must not escape to reset');
 await page.keyboard.press('Escape'); assert.equal(await focusId(),'set-language');
 // Exercise the controller command path separately; no physical device claim.
 await page.evaluate(()=>__G.menus.nav('accept'));
 await page.evaluate(()=>__G.menus.nav('down'));
 assert.equal(await focusId(),'language-zh-Hant');
 await page.evaluate(()=>__G.menus.nav('back'));
 assert.equal(await focusId(),'set-language');
 // The same focused row must respond to the engine's keyboard/gamepad navigation path.
 await page.click('[data-id="set-language"]');
 await page.keyboard.press('ArrowDown');
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'zh-Hans','browsing must not apply');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>__G.menus._focus.dataset.id),'set-language');
 assert.equal(await page.evaluate(()=>document.querySelector('[data-id="set-language"]').getAttribute('aria-expanded')),'false');
 await page.keyboard.press('Enter');
 await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.documentElement.lang==='zh-Hant');
 await page.click('[data-id="set-language"]');
 await page.mouse.click(20,20);
 assert.equal(await page.evaluate(()=>__G.menus.current),'settings','outside click must only close list');
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'zh-Hant');
 for (const [width,height] of [[1440,900],[960,540]]) {
  await page.setViewport({width,height});
  await page.click('[data-id="set-language"]');
  await new Promise(ok=>setTimeout(ok,400));
  assert.ok(await page.evaluate(()=>{const r=document.querySelector('.iw-select-popup:not(.is-leaving) .iw-select__list').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),'dropdown outside viewport');
  assert.ok(await page.evaluate(()=>{const a=document.querySelector('.iw-tab.is-sel').getBoundingClientRect(),b=document.querySelector('.iw-tabs__hl').getBoundingClientRect();return Math.abs(a.left-b.left)<2&&Math.abs(a.width-b.width)<2;}),'tab highlight misaligned after resize');
  await page.screenshot({path:`.local/native-i18n/language-dropdown-${width}.png`});
  await page.keyboard.press('Escape');
 }
 await page.click('[data-id="set-language"]');
 await page.click('.iw-select__option[data-value="zh-Hans"]');
 await page.reload({waitUntil:'networkidle0',timeout:120000});
 await page.waitForFunction('window.__G?.menus?.current === "main"',{timeout:120000});
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'zh-Hans');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({results,errors,noReload:true,keyboardNavigation:true,persisted:true,crossTabFocus:true,pointerHover:true,controllerCommandPath:true,physicalController:false}));
} catch(e) {console.log(JSON.stringify({errors}));throw e;} finally {await browser.close();}
