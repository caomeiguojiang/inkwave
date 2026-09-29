# Assertok deployment

Fork: https://github.com/caomeiguojiang/inkwave, branch `codex/assertok`.
Original game: https://github.com/jaydendavisnc/inkwave, MIT, Jayden Davis.
Upstream baseline: `53b9aa3fc2dc1201f14c87d165597ce37c12118a`.

The original game source, artwork, credits and Cloudflare server remain intact.
`tools/build-assertok.mjs` assembles a separate `dist/` with a reviewed translation
catalog and a same-origin WebSocket endpoint. `server-node/` implements the upstream
version-1 relay protocol and serves only `dist/`. It is a relay, not an authoritative
game server; the room host still simulates the match. Rooms disappear on restart.

## Build and verify

Requires Node 24.14.0, Python 3, Chrome and Docker (WSL works on Windows).

```powershell
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix server-node
npm run build:assertok
node --test tools/test-i18n.mjs server-node/test.mjs
$env:PORT='8490'
$env:STATIC_ROOT=(Resolve-Path dist).Path
node server-node/index.js
```

In another terminal, run `npm run test:web` and
`node tools/net-test-assertok.mjs --url http://127.0.0.1:8490/ --clients 2 --quality low --secs 12 --full --leave host`.
Set `CHROME_PATH` to use another Chrome binary and `INKWAVE_URL` for public checks.
Build the image only after all build and verification commands succeed:
`docker build -f Dockerfile.assertok -t inkwave:YYYYMMDD-release-N .`.
Never reuse a published release tag.

## Languages

English, Simplified Chinese, Traditional Chinese and Japanese are supported.
Selection order is valid `?lang=`, saved manual choice, browser `navigator.languages`,
then English. Chinese region/script tags distinguish Simplified and Traditional.
The language selector persists the choice and reloads from the menu; it hides in a
connected lobby or match. Player names and network identifiers remain unchanged.

Translations live in `src/i18n/messages.tsv`: English key, Simplified Chinese,
Japanese, optional Traditional Chinese override (tab-separated). Traditional
Chinese otherwise uses pinned OpenCC. Build validates placeholders and duplicates,
parses edited JavaScript, and reports unused translations in `.local/i18n-build.json`.
New upstream text falls back to English until reviewed; translated artwork text
and human language review are not guaranteed by automated browser tests.

## Receive author updates

Keep `origin/main` as the upstream mirror; custom deployment work stays on
`codex/assertok`. Configure `upstream` to the original URL above.
Run `node tools/upstream-status.mjs` to fetch and show new commits without merging.
From a clean deployment branch, create an update branch and review a merge:

```powershell
git switch -c codex/upstream-YYYYMMDD
git merge --no-commit --no-ff upstream/main
```

Inspect release notes and changes to UI, transport, protocol, build and assets.
Use `node tools/extract-i18n.mjs` to regenerate translation candidates, review
new strings, update translations, and run the full build/browser/relay tests.
Resolve conflicts before committing; `git merge --abort` cancels a pending merge.
Merge the reviewed update into `codex/assertok`, push it, and deploy a new pinned
image through 1Panel. A fetch does not change production. Do not auto-merge or
auto-deploy untested author updates, and do not replace the fork with `reset --hard`.

Server-owned Compose, DNS, backup and release records live in the separate
`lighthouse` repository under `server-admin/TencentLighthouse122/sites/inkwave/`.
