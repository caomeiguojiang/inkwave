// Run the upstream measurement unchanged except for portable browser launch configuration.
import { readFileSync,writeFileSync,unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
let source=readFileSync('tools/net-test.mjs','utf8');
source=source.replace("executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',","executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',");
source=source.replace("'--use-angle=metal', ",'');
// Upstream launches clients concurrently; push() can misalign browsers and pages.
source=source.replace('browsers.push(b); pages[i] = p;', 'browsers[i] = b; pages[i] = p;');
source=source.replace('const p = await b.newPage();', "const p = await b.newPage(); await p.evaluateOnNewDocument(tag => { Object.defineProperty(navigator, 'languages', {get:()=>[tag]}); }, i === 0 ? 'zh-CN' : 'ja-JP');");
const file=resolve('tools/.net-test-assertok.generated.mjs');
if (process.argv.includes('--language-switch')) {
  const marker="  say('--- consistency');";
  if (!source.includes(marker)) throw Error('Upstream test changed: review language test insertion');
  source=source.replace(marker,`
  const switched = await ev(1, async () => {
    const game=__G.game, match=__G.match, net=__G.net, id=net.myId, socket=net.tr.ws, origin=performance.timeOrigin;
    const root=__G.hud.el, hud=__G.hud;
    __G.game.menus.show('settings');
    const row=__G.game.menus._scr.el.querySelector('[data-id="set-language"]');
    row.click();
    __G.game.menus._modal.querySelector('[data-value=\"zh-Hans\"]').click();
    await new Promise(ok=>setTimeout(ok,50));
    if (document.documentElement.lang!=='zh-Hans' || __G.game!==game || __G.match!==match || __G.net!==net || net.myId!==id || !id || net.tr.ws!==socket || socket.readyState!==WebSocket.OPEN || performance.timeOrigin!==origin || __G.hud!==hud || hud.el!==root) throw Error('Language switch changed game/session/HUD identity');
    const {translate}=await import('/src/i18n/runtime.js');
    if (root.querySelector('.iw-tank__low').textContent!==translate('LOW INK')) throw Error('Existing HUD did not update');
    if (__G.game.menus._focus?.dataset.id!=='set-language') throw Error('Settings focus lost');
    __G.game.menus.show(null);
    return {language:document.documentElement.lang,state:net.state,gameAndSessionPreserved:true,hudPreserved:true};
  });
  say('live language switch',JSON.stringify(switched));
`+marker);
}
writeFileSync(file,source);process.on('exit',()=>{try{unlinkSync(file);}catch{}});
await import(pathToFileURL(file));
