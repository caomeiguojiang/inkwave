// Compile only reviewed presentation strings. Upstream source remains untouched.
// Unknown/new strings stay English; audit output makes upstream translation drift visible.
import { parse } from 'acorn';
import * as OpenCC from 'opencc-js';
import { readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync,unlinkSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname,relative } from 'node:path';
import { execFileSync } from 'node:child_process';
execFileSync(process.platform === 'win32' ? 'python' : 'python3',['-X','utf8','tools/build-dist.py'],{stdio:'inherit'});
const tw = OpenCC.Converter({from:'cn',to:'tw'});
const catalogs = {en:{},'zh-Hans':{},'zh-Hant':{},ja:{}};
for (const row of readFileSync('src/i18n/messages.tsv','utf8').trim().split('\n')) {
  if (!row || row.startsWith('#')) continue;
  const [en,zh,ja,hant] = row.replace(/\r$/,'').split('\t');
  if (!en || !zh || !ja) throw Error('Incomplete translation: '+row);
  if (catalogs.ja[en]) throw Error('Duplicate translation: '+en);
  catalogs['zh-Hans'][en]=zh; catalogs['zh-Hant'][en]=hant || tw(zh); catalogs.ja[en]=ja;
  for (const text of [zh,ja,hant || tw(zh)]) {
    const vars=s => [...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort().join(',');
    if (vars(en)!==vars(text)) throw Error('Placeholder mismatch: '+en);
  }
}
writeFileSync('dist/src/i18n/catalogs.js',`export const catalogs = ${JSON.stringify(catalogs)};\n`);
const files=['src/config.js','src/main.js','src/game/character-style.js',...readdirSync('src/ui').filter(f=>f.endsWith('.js')).map(f=>'src/ui/'+f)];
const used=new Set(); let replacements=0;
for (const file of files) {
  let src=readFileSync(file,'utf8'); const edits=[];
  const expression = n => {
    const offset=edits.length; walk(n,null);
    let text=src.slice(n.start,n.end);
    for (const [a,b,v] of edits.splice(offset).sort((a,b)=>b[0]-a[0])) text=text.slice(0,a-n.start)+v+text.slice(b-n.start);
    return text;
  };
  const walk=(n,parent) => {
    if (!n || typeof n!=='object') return;
    const protectedNode = parent && ((parent.type==='Property' && parent.key===n) || parent.type==='ImportDeclaration' || parent.type==='ExportNamedDeclaration' || parent.type==='BinaryExpression' || parent.type==='SwitchCase' || (parent.type==='MemberExpression' && parent.property===n));
    if (!protectedNode && n.type==='Literal' && typeof n.value==='string' && catalogs.ja[n.value]) {
      edits.push([n.start,n.end,`__iwT(${JSON.stringify(n.value)})`]); used.add(n.value); return;
    }
    if (!protectedNode && n.type==='TemplateLiteral' && parent?.type!=='TaggedTemplateExpression') {
      const key=n.quasis.map((q,i)=>q.value.cooked+(i<n.expressions.length?`{${i}}`:'')).join('');
      if (catalogs.ja[key]) {
        edits.push([n.start,n.end,`__iwF(${JSON.stringify(key)},[${n.expressions.map(expression).join(',')}])`]); used.add(key); return;
      }
    }
    for (const v of Object.values(n)) { if (Array.isArray(v)) v.forEach(x=>walk(x,n)); else if (v && typeof v==='object') walk(v,n); }
  };
  walk(parse(src,{ecmaVersion:'latest',sourceType:'module'}));
  for (const [a,b,v] of edits.sort((a,b)=>b[0]-a[0])) src=src.slice(0,a)+v+src.slice(b);
  if (edits.length) { let path=relative(dirname(file),'src/i18n/runtime.js').replaceAll('\\','/'); if (!path.startsWith('.')) path='./'+path; src=`import {t as __iwT,f as __iwF} from '${path}';\n`+src; }
  parse(src,{ecmaVersion:'latest',sourceType:'module'});
  writeFileSync('dist/'+file,src); replacements+=edits.length;
}
// Public deployment always uses its own same-origin relay, including local release testing.
const transport='dist/src/net/transport.js';
let source=readFileSync(transport,'utf8');
const old="export const PROD_RELAY = 'wss://inkwave-net.inkwave.workers.dev';";
if (!source.includes(old) || !source.includes('return local ?')) throw Error('Upstream transport changed: review adapter');
source=source.replace(old,"export const PROD_RELAY = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;");
source=source.replace('return local ? `ws://${h}:8787` : PROD_RELAY;','return PROD_RELAY;');
writeFileSync(transport,source);
let html=readFileSync('dist/index.html','utf8');
html=html.replace('</head>','<link rel="stylesheet" href="styles/i18n.css">\n</head>').replace('<script type="module" src="./src/main.js">','<script type="module" src="./src/i18n/selector.js"></script>\n<script type="module" src="./src/main.js">');
writeFileSync('dist/index.html',html);
copyFileSync('LICENSE','dist/LICENSE');
unlinkSync('dist/src/i18n/messages.tsv');
for (const entry of readdirSync('dist',{recursive:true,withFileTypes:true})) {
  if (entry.isFile() && /\.(js|css|html|json)$/.test(entry.name)) {
    const p=(entry.parentPath || entry.path)+'/'+entry.name;
    writeFileSync(p+'.gz',gzipSync(readFileSync(p),{level:9}));
  }
}
mkdirSync('.local',{recursive:true});
writeFileSync('.local/i18n-build.json',JSON.stringify({entries:Object.keys(catalogs.ja).length,replacements,unused:Object.keys(catalogs.ja).filter(k=>!used.has(k))},null,2));
console.log(`Localized ${replacements} source expressions with ${Object.keys(catalogs.ja).length} messages`);
