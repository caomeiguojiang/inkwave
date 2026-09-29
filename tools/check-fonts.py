"""Fail packaging when a translated CJK UI character is missing from a bundled font."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
for region,locale in [('SC','zh-Hans'),('TC','zh-Hant'),('JP','ja')]:
    messages=json.loads((Path('src/i18n/locales')/(locale+'.json')).read_text(encoding='utf8'))
    chars=set(''.join(messages.values())+'简体中文繁體中文日本語言語语言')
    codes={ord(c) for c in chars if 0x3000<=ord(c)<=0x9fff or 0xf900<=ord(c)<=0xffef}
    for weight in ['Medium','Bold','Black']:
        font=TTFont(f'assets/fonts/swei/{region}-{weight}.woff2')
        missing=codes-set(font.getBestCmap())
        if missing: raise ValueError(f'{region}-{weight}: '+''.join(chr(c) for c in sorted(missing)))
print('CJK coverage passed for all 9 bundled fonts')
