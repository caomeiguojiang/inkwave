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
const slowIndex=process.argv.indexOf('--slow-client-ms');
if(slowIndex>=0){
  const delay=Number(process.argv[slowIndex+1]);
  if(!Number.isFinite(delay)||delay<0||delay>30000)throw new Error('Invalid slow-client-ms');
  source=source.replace('const tStart = Date.now();', `await ev(1, ms => { const game=__G.game, original=game.startNetMatch.bind(game); game.startNetMatch=async (...args)=>{await original(...args);await new Promise(r=>setTimeout(r,ms));}; }, ${delay});\n  const tStart = Date.now();`);
}
const file=resolve('tools/.net-test-assertok.generated.mjs');
// Zone Control deliberately ignores lobby.duration. Shorten its test-only rules
// before the host emits the config, just as upstream shortens Turf War above.
source=source.replace('  const tStart = Date.now();', `
  if (FULL && MODE === 'zones') await ev(0, async () => { (await import('/src/config.js')).ZONES.duration = 40; });
  const tStart = Date.now();`);
// Exercise custom equipment across the room protocol, including the new kits.
source=source.replace("  const lobbies = await Promise.all", `
  for (let i=0;i<N;i++) await ev(i, async i => {
    const {WEAPON_ORDER,SUB_ORDER,SPECIAL_ORDER}=await import('/src/config.js');
    __G.net.setMe({weapon:WEAPON_ORDER[(i+6)%WEAPON_ORDER.length],sub:SUB_ORDER[(i+6)%SUB_ORDER.length],special:SPECIAL_ORDER[(i+8)%SPECIAL_ORDER.length]});
  }, i);
  await new Promise(r=>setTimeout(r,150));
  const lobbies = await Promise.all`);
source=source.replace("  say('--- consistency');", `
  const equipment=await Promise.all(pages.filter(Boolean).map(p=>p.evaluate(()=>__G.match.actors.map(a=>[a.nid,a.weaponId,a.subId,a.specialId]).sort((a,b)=>a[0]-b[0]))));
  if(new Set(equipment.map(v=>JSON.stringify(v))).size!==1)throw Error('Equipment differs between clients');
  say('equipment agrees',JSON.stringify(equipment[0]));
  say('--- consistency');`);
source=source.replace('w: __inkwave.match.result.winner,', 'w: __inkwave.match.result.winner, zones: __inkwave.match.result.mode === \"zones\" ? {counts:__inkwave.match.result.counts,penalty:__inkwave.match.result.penalty,reason:__inkwave.match.result.reason} : null,');
source=source.replace("    say('results', res.join('  '),", "    if(new Set(res).size!==1)throw Error('Final results differ');\n    say('results', res.join('  '),");
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
