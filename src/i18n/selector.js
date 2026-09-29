import { language, LANGUAGES } from './runtime.js';
const labels = {en:'English', 'zh-Hans':'简体中文', 'zh-Hant':'繁體中文', ja:'日本語'};
const control = document.createElement('label');
control.className = 'iw-language';
const caption = document.createElement('span'); caption.textContent = '🌐';
const select = document.createElement('select'); select.setAttribute('aria-label', 'Language / 语言 / 語言 / 言語');
for (const code of LANGUAGES) { const option = new Option(labels[code],code); option.selected = code === language; select.add(option); }
select.addEventListener('change', () => {
  try { localStorage.setItem('inkwave.language',select.value); } catch { /* query preserves choice */ }
  const url = new URL(location.href); url.searchParams.set('lang',select.value); location.replace(url);
});
for (const name of ['keydown','keyup','pointerdown','pointerup','click']) control.addEventListener(name,e => e.stopPropagation());
control.append(caption,select); document.body.append(control);
// Never offer a reload during a lobby or match; switch languages from the main menu.
setInterval(() => { control.hidden = !!globalThis.__G && (__G.mode === 'match' || (__G.net && !['offline','error'].includes(__G.net.state))); },400);
