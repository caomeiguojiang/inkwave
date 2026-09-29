import { parse } from 'acorn';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const files = ['src/config.js', 'src/main.js', 'src/game/character-style.js', ...['menus', 'hud', 'hud-boss', 'menu-art', 'ui-icons', 'news', 'diorama', 'boss-art'].map(x => `src/ui/${x}.js`)];
const strings = new Map();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const walk = (n, parent) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'Literal' && typeof n.value === 'string' && /[A-Z][a-z]|[A-Z]{3}/.test(n.value) && !/[<>]|\.js$|^#|^\.|^\/|^M\d|^https?:|^--/.test(n.value) && n.value.length < 800 && !(parent?.type === 'Property' && parent.key === n)) {
      if (!strings.has(n.value)) strings.set(n.value, []);
      strings.get(n.value).push(file);
    }
    for (const [k,v] of Object.entries(n)) if (k !== 'start' && k !== 'end') {
      if (Array.isArray(v)) v.forEach(x => walk(x,n)); else if (v && typeof v === 'object') walk(v,n);
    }
  };
  walk(parse(src, { ecmaVersion:'latest', sourceType:'module' }));
}
mkdirSync('.local',{recursive:true});
const reviewed=new Set(Object.keys(JSON.parse(readFileSync('src/i18n/locales/en.json','utf8'))));
writeFileSync('.local/i18n-candidates.json', JSON.stringify({candidates:[...strings.keys()],unreviewed:[...strings.keys()].filter(s=>!reviewed.has(s))}, null, 2));
console.log(strings.size);
