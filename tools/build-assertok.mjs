// Package the native source. Localization belongs to source modules, never to build-time rewriting.
import {readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
const en=JSON.parse(readFileSync('src/i18n/locales/en.json','utf8'));
const vars=s=>[...s.matchAll(/\{\{([^}]+)\}\}/g)].map(m=>m[1]).sort().join(',');
for(const locale of ['zh-Hans','zh-Hant','ja']){
  const messages=JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`,'utf8'));
  for(const key of Object.keys(en)) {
    if (key.endsWith('_one') && !new Intl.PluralRules(locale).resolvedOptions().pluralCategories.includes('one')) continue;
    if(!messages[key] || vars(messages[key])!==vars(en[key])) throw Error(`Invalid ${locale} translation: ${key}`);
  }
}
execFileSync(process.execPath,['build/music-manifest.mjs'],{stdio:'inherit'});
const python=process.platform==='win32'?'python':'python3';
execFileSync(python,['-X','utf8','tools/check-fonts.py'],{stdio:'inherit'});
execFileSync(python,['-X','utf8','tools/build-dist.py'],{stdio:'inherit'});
copyFileSync('LICENSE','dist/LICENSE');
for(const entry of readdirSync('dist',{recursive:true,withFileTypes:true})){
  if(entry.isFile()&&/\.(js|css|html|json)$/.test(entry.name)){
    const path=(entry.parentPath||entry.path)+'/'+entry.name;
    writeFileSync(path+'.gz',gzipSync(readFileSync(path),{level:9}));
  }
}
console.log(`Native i18next build: ${Object.keys(en).length} messages, no source rewriting`);
