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
writeFileSync(file,source);process.on('exit',()=>{try{unlinkSync(file);}catch{}});
await import(pathToFileURL(file));
