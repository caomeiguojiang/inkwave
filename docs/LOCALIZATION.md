# Native localization and typography

## Project knowledge

INKWAVE is plain ES modules and a native DOM UI, without React or a bundler. The
render loop, WebGL renderer, actors and online session live independently from menu
views. Start with `docs/CONTRACTS.md`, `docs/NET.md` and `docs/BOSS.md` for ownership.

- `src/main.js`: game lifecycle, `inkwave.settings` persistence and settings application.
- `src/config.js`: gameplay definitions, stable IDs and settings defaults.
- `src/ui/menus.js`: menu stack, settings tabs/rows, cursor and keyboard/gamepad navigation.
- `src/ui/menu-art.js`: settings preview cards and reusable illustrations.
- `src/ui/hud.js`, `hud-boss.js`: long-lived HUD, event-driven effects and per-frame values.
- `src/ui/ui-util.js`: native DOM factory `h`, not a framework component tree.
- `styles/ui.css`: established ink palette, rounded panels, segmented controls, motion tokens.
- `src/net/session.js`: rooms and players; never recreate it for a presentation preference.

Use the existing controls and preview panel when extending settings. The language
row is in General, with a styled dropdown containing Auto and four native-language
names. Enter/A opens it; up/down browse without applying, Enter/A confirms, and
Escape/B or an outside click cancels. It uses the existing modal/focus navigation,
restores the row focus, and keeps the popup inside the viewport.

## i18next

`src/i18n/runtime.js` initializes pinned i18next 26.4.2 with bundled resources from
`src/i18n/locales/{en,zh-Hans,zh-Hant,ja}.json`. The MIT library and its license are
vendored under `vendor/i18next/`; there are no third-party translation requests.
The normal source server and normal `tools/build-dist.py` both use the same code.
The deployment build validates and compresses assets; it never injects or rewrites UI source.

Use `translate(key, options)` at render time. Existing English message keys are
retained for readable source and compatibility; new contextual messages can use
named keys, such as `room.codeRemaining`, with i18next `_one` / `_other` forms.
`formatMessage` adapts numbered interpolation parameters for migrated messages.
Never translate player names, room codes, map/weapon IDs or protocol error keys.
Escape user-provided values at HTML sinks. Translation interpolation itself does
not escape because both textContent and already-escaped HTML are used by this UI.

Config metadata uses getters for localized labels; gameplay objects and IDs retain
their identity. Do not evaluate a localized label into a module-level constant:
it would remain in the startup language. Arrays of message keys translate at the
presentation site. Locale resources are independent files; Traditional Chinese is
editable directly and is no longer regenerated from Simplified Chinese on each build.

## Hot switching

The engine saves `settings.language`, then calls i18next `changeLanguage`. Auto
resolves `navigator.languages` in order, falls back to English, and distinguishes
Chinese script/region variants. Old `inkwave.language` preferences are read only
for migration when the unified settings have no language. `?lang=` can seed a test
session; changing the setting removes that parameter without navigating.

Menus subscribe to `languageChanged` and refresh the visible view without entrance
animations. They keep the existing navigation stack, settings tab and focused row.
The Game, renderer, match, players, network session and WebSocket are not replaced.

The HUD stays mounted. Explicit localized children (`h('span', null, () =>
translate('LOW INK'))`) and `setLocalizedText/HTML` refresh only on language change.
Bindings use WeakMap ownership and avoid rewriting a value subsequently replaced
by another game event. There is no MutationObserver, DOM text lookup, prototype
patch, periodic translation pass or page reload. Dispose subscriptions with the owner.

## Fonts

Latin display/body remain Titan One/Rubik. CJK uses Swei Gothic regional SC, TC and
JP glyphs: Black for display, Medium/Bold for body. `--font-display` and
`--font-body` apply to existing font shorthands, including settings and HUD.

`tools/build-fonts.py` fetches a pinned upstream revision into ignored local cache,
checks glyph coverage and subsets WOFF2 per locale. Outputs, source/output SHA256
and the OFL license are under `assets/fonts/swei/`. The source fonts are not uploaded.
Run it after changing translations; verify every locale's CJK characters against
the resulting font cmap. User-generated names outside these fixed UI subsets may
use the platform fallback font. CSS loads only the active locale's used fonts.

## Verification and updates

- `node --test tools/test-i18n.mjs server-node/test.mjs`: negotiation, live config labels,
  interpolation, fallback and protocol invariants.
- `node tools/test-language-switch.mjs`: real browser settings, stable timeOrigin/Game,
  focus/navigation and persisted preference.
- `node tools/verify-assertok.mjs`: four initial browser locales and menu screens.
- `node tools/net-test-assertok.mjs --clients 2 --quality low --secs 12 --full --language-switch`:
  switch through the native settings during a real match; assert same Game/Match/HUD,
  player ID and open WebSocket, then compare final results and return to the lobby.

Set `INKWAVE_URL` for browser checks and `--url` for the multiplayer test. Screenshots
are local artifacts, not proof of physical-controller or Safari-device acceptance.
When merging upstream, review changed UI copy and control structure normally. Do
not restore the retired build-time AST translation adapter or floating selector.
