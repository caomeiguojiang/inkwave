import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const base=process.env.INKWAVE_URL || 'http://127.0.0.1:8490/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu'],defaultViewport:{width:1440,height:900}});
try {
 const page=await browser.newPage();
 await page.goto(base+'?skipTitle&news=0',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction('window.__G?.menus?.current === "main"',{timeout:180000});
 const results=await page.evaluate(async()=>{
  const {NetSession}=await import('/src/net/session.js');
  const {ERR,netError}=await import('/src/net/errors.js');
  const {SpecialSystem}=await import('/src/game/specials.js');
  const {changeLanguage}=await import('/src/i18n/runtime.js');
  const {SPECIALS,SUBS}=await import('/src/config.js');
  const check=(v,m)=>{if(!v)throw Error(m);};
  const retry=new NetSession();let attempts=0;
  retry._connect=async()=>{if(++attempts<3)throw netError(ERR.CODE_TAKEN,'任意本地化消息');};
  await retry.create('test');check(attempts===3,'retry depended on wording');
  attempts=0;retry._connect=async()=>{attempts++;throw netError(ERR.CONNECT,'Room code taken');};
  try{await retry.create('test');}catch{}
  check(attempts===1 && retry.errorCode===ERR.CONNECT,'incorrect retry/error code');
  const host=new NetSession(),guest=new NetSession();
  try {
   await host.create('test');await guest.join(host.code,'guest');
   check(host.state==='lobby' && guest.state==='lobby','real relay join');
  }finally{guest.leave();host.leave();}
  const missing=new NetSession();
  try{await missing.join('ZZZZZ','test');}catch{}
  check(missing.errorCode===ERR.NOT_FOUND,'relay code not propagated');
  const prompts=[];
  for(const lang of ['en','zh-Hans','zh-Hant','ja']) {
   await changeLanguage(lang);
   const values=[];
   for(const kind of ['barrage','strike','zooka','wail','kraken','blower','jetpack','stamp','booyah','zipcaster','crab','booyah-alt','zipcaster-alt','crab-alt']) {
    const alternate=kind.endsWith('-alt');
    const active={kind:kind.replace('-alt',''),def:{name:SPECIALS.zooka?.name || 'Special',max:3},bomb:{name:SUBS.bomb?.name || 'Bomb'},count:1,aiming:true,charge:alternate?0:1,hang:alternate?0:1,roll:alternate};
    const text=SpecialSystem.prototype.prompt({specialActive:active});
    check(typeof text==='string' && text.length>0 && !text.includes('{{'),'bad prompt '+kind);
    if(lang!=='en')check(!/Fire twisters|Hold LMB|Throw .*with RMB|LMB to stamp/.test(text),'English prompt '+kind);
    values.push(text);
   }
   prompts.push({lang,count:values.length});
  }
  await changeLanguage('en');
  return {retryByCode:true,realRelay:true,missingCode:missing.errorCode,prompts};
 });
 assert.equal(results.prompts.length,4);
 console.log(JSON.stringify(results));
}finally{await browser.close();}
