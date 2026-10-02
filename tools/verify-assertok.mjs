import puppeteer from 'puppeteer-core';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.INKWAVE_URL || 'http://127.0.0.1:8490/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding'],defaultViewport:{width:1440,height:900,deviceScaleFactor:1}});
const errors=[], results=[]; mkdirSync('.local/screens',{recursive:true});
try {
  for (const [lang,label] of [['zh-CN','开始游戏'],['zh-TW','開始遊戲'],['ja-JP','プレイ'],['en-US','PLAY']]) {
    const context=await browser.createBrowserContext(); const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.evaluateOnNewDocument(tag=>{Object.defineProperty(navigator,'languages',{get:()=>[tag]});localStorage.setItem('inkwave.settings',JSON.stringify({quality:'low'}));},lang);
    await page.goto(base+'?skipTitle&news=0&shadercheck',{waitUntil:'networkidle0',timeout:120000});
    await page.waitForFunction('window.__G?.menus?.current === "main"',{timeout:120000});
    const text=await page.evaluate(()=>document.body.innerText);assert.ok(text.includes(label),lang+' missing '+label);
    results.push({lang,htmlLang:await page.evaluate(()=>document.documentElement.lang),main:true});
    await page.screenshot({path:`.local/screens/${lang}-main.png`});
    if (lang==='zh-CN' || lang==='ja-JP') for (const screen of ['settings','howto','loadout','setup','online']) {
      await page.evaluate(s=>__G.menus.show(s),screen);
      await page.waitForFunction(s=>__G.menus.current===s && (s!=='loadout'||__inkwave.worldReady),{timeout:180000},screen);
      await new Promise(ok=>setTimeout(ok,550));await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`.local/screens/${lang}-${screen}.png`});
      writeFileSync(`.local/screens/${lang}-${screen}.txt`,await page.evaluate(()=>document.body.innerText));
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
} finally { await browser.close(); }
