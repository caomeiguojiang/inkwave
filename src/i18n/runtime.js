import { catalogs } from './catalogs.js';
export const LANGUAGES = ['en', 'zh-Hans', 'zh-Hant', 'ja'];
export function matchLanguage(tags = []) {
  for (const tag of tags) {
    const s = String(tag).toLowerCase();
    if (/^zh(?:-|$)/.test(s)) return s.includes('-hans') ? 'zh-Hans' : /hant|-(tw|hk|mo)(-|$)/.test(s) ? 'zh-Hant' : 'zh-Hans';
    if (/^ja(?:-|$)/.test(s)) return 'ja';
    if (/^en(?:-|$)/.test(s)) return 'en';
  }
  return 'en';
}
let saved; try { saved = localStorage.getItem('inkwave.language'); } catch { /* storage disabled */ }
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
export const language = LANGUAGES.includes(query) ? query : LANGUAGES.includes(saved) ? saved : matchLanguage(globalThis.navigator?.languages || [globalThis.navigator?.language]);
if (typeof document !== 'undefined') document.documentElement.lang = language;
export function t(source) { return catalogs[language]?.[source] ?? source; }
export function f(source, values) {
  // These English plural suffixes have no equivalent in the other three locales.
  if (language !== 'en' && ['{0} more character{1} to go', '{0} bot{1} join {2}'].includes(source)) values = values.map((v,i) => i === 1 ? '' : v);
  return t(source).replace(/\{(\d+)\}/g, (_, n) => String(values[Number(n)]));
}
