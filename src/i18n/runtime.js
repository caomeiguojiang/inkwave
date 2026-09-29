import i18next from '../../vendor/i18next/i18next.js';
import en from './locales/en.json' with { type: 'json' };
import zhHans from './locales/zh-Hans.json' with { type: 'json' };
import zhHant from './locales/zh-Hant.json' with { type: 'json' };
import ja from './locales/ja.json' with { type: 'json' };

export const LANGUAGES = ['en', 'zh-Hans', 'zh-Hant', 'ja'];
export const LANGUAGE_NAMES = {en:'English', 'zh-Hans':'简体中文', 'zh-Hant':'繁體中文', ja:'日本語'};
export function matchLanguage(tags = []) {
  for (const tag of tags) {
    const s = String(tag).toLowerCase();
    if (/^zh(?:-|$)/.test(s)) return s.includes('-hans') ? 'zh-Hans' : /hant|-(tw|hk|mo)(-|$)/.test(s) ? 'zh-Hant' : 'zh-Hans';
    if (/^ja(?:-|$)/.test(s)) return 'ja';
    if (/^en(?:-|$)/.test(s)) return 'en';
  }
  return 'en';
}
export function resolveLanguage(preference) {
  return LANGUAGES.includes(preference) ? preference : matchLanguage(globalThis.navigator?.languages || [globalThis.navigator?.language]);
}
let saved;
try { saved = JSON.parse(localStorage.getItem('inkwave.settings') || '{}').language ?? localStorage.getItem('inkwave.language'); } catch { /* storage disabled */ }
const query = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
export const initialPreference = LANGUAGES.includes(query) ? query : ['auto', ...LANGUAGES].includes(saved) ? saved : 'auto';
await i18next.init({
  lng:resolveLanguage(initialPreference), fallbackLng:'en', supportedLngs:LANGUAGES,
  load:'currentOnly', keySeparator:false, nsSeparator:false,
  resources:{en:{translation:en},'zh-Hans':{translation:zhHans},'zh-Hant':{translation:zhHant},ja:{translation:ja}},
  // Callers escape user content before including it in HTML. DOM text uses textContent.
  interpolation:{escapeValue:false}, returnEmptyString:false,
});
function updateDocument() { if (typeof document !== 'undefined') document.documentElement.lang = i18next.resolvedLanguage; }
updateDocument();
i18next.on('languageChanged', updateDocument);
export const currentLanguage = () => i18next.resolvedLanguage;
export const translate = (key, options) => i18next.t(key, options);
export function formatMessage(source, values) {
  return translate(source, Object.fromEntries(values.map((value,index) => [index,value])));
}
export function changeLanguage(preference) {
  if (!['auto',...LANGUAGES].includes(preference)) throw new RangeError('Unsupported language');
  // The engine owns persistence in inkwave.settings. Remove the old query override.
  if (typeof location !== 'undefined' && typeof history !== 'undefined') {
    const url = new URL(location.href); url.searchParams.delete('lang'); history.replaceState(history.state,'',url);
  }
  return i18next.changeLanguage(resolveLanguage(preference));
}
export function onLanguageChanged(callback) {
  i18next.on('languageChanged',callback);
  return () => i18next.off('languageChanged',callback);
}
