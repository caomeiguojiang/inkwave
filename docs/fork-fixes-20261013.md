# Selective fork fixes — 2026-10-13

## Scope and provenance

The original upstream remains unavailable. The fork network's root is not an
author-endorsed replacement. Preserve the existing upstream remote and our four
locales, fonts, approved settings UI, original rendering and gameplay behavior.

The saved history in `qn1994526/inkwave` contains original upstream merges through
`679d2dba48457c239f2c60ba1ffc17d1fe789f07` (2026-10-09). This advances the review
checkpoint, not the last fully merged ancestor.

| Change | Source | Decision |
| --- | --- | --- |
| Retry pointer lock on a click during intro/playing | `qn1994526/inkwave`, `eaf2eb82545f82dba629d289e69e2f4d792f9cd8` | Port the original upstream fix. Paused/menu/result states remain free. |
| Judge screen `t()` shadowing | `qn1994526/inkwave`, `429d570902a823ce775c04865b424a7e52b0cb8b` | Not applicable: our calls use `translate` and `formatMessage`. |
| Stop retaining old actors in FX state | `sebz1337-dev/inkwave`, `94c79e35506cc92957d28eee206248ffc2d67b17`, attributed there to `anfaal/e77d2d9` | Change actor-keyed `st` and `flickT` to WeakMap. Neither map is enumerated. |
| Bound respawn hiding | `jy1024898670-lang/inkwave-modify`, `9822785c39abaaa9b1839a61063cb232a5f2850c` | Adapt the 1.5-second deadline in `_sample`, only when a post-respawn sample exists. Discard stale per-actor history and copy the complete new sample before normal teleport correction. Avoid the source patch's late position-only override, which can rewind on a subsequent frame. Do not move the shared owner playback clock. |

No GPU preference changes, quality reduction, loading pipeline, movement/balance,
cheats, mobile controls, or bulk integration. Allocation optimizations remain a
separate performance review, not part of these three bug fixes.

## Validation

- `node --expose-gc --test tools/test-fork-fixes.mjs`: 5 passed. Covers late
  respawn and the following frame, ordinary respawn, missing new data, unaffected
  actors, and actual garbage collection while FX hooks remain alive.
  The same tests against pre-fix `9719eda` fail the late-respawn and actor-retention
  cases (2 failures, 3 passes), confirming they detect the original defects.
- `node tools/test-pointer-relock.mjs`: headless Chrome obtained real pointer lock
  in intro/playing after an unlocked resume, with no firing on the relock click.
  Paused, settings, judge and results guards passed. No page errors.
- `node --test tools/test-i18n.mjs tools/test-net-errors.mjs`: 5 passed.
- `node tools/build-assertok.mjs`: passed, all 9 bundled CJK fonts and 1001
  localization messages validated.
- Two-client full Turf War with `netlag=100&netjitter=60`, low quality and an
  in-match language switch: equipment and results agreed, match/HUD/socket identity
  retained; clock spread 0.16 seconds; no measured remote teleports. An early lobby
  snapshot differed while delayed loadout messages were in flight; the match
  equipment check later agreed. This run does not establish every delayed lobby
  interaction or reproduce a real browser background freeze.
- Changed JavaScript syntax and `git diff --check` passed.
- `node tools/test-original-behavior.mjs`: passed. Fresh High quality, 8-actor
  homepage AI match, menu music, immediate quality setting, locker, lobby and
  missing optional lightmap fallback retain their existing behavior.
- `node tools/test-language-switch.mjs`: passed for all four locales, no reload,
  persistence, keyboard navigation, hover, focus return and controller command
  routing. No physical controller was tested.

These are local source/build checks, Node regression tests and Chromium runtime
checks. No production release, Safari/phone acceptance or physical gamepad test.

## Maintenance activity assessment

Survey: 172 direct forks plus repository-name search; inspect recent histories,
not GitHub `pushed_at` or all-time contributor totals alone. Candidate default
branches checked; activity on every non-default branch was not audited.

- `sebz1337-dev`: 31 commits unique to the saved Oct-9 upstream baseline, all
  committed by one account. A useful patch index, not demonstrated team maintenance.
  Its integration record explicitly limits validation largely to syntax checks.
- `norfan/fork-inkwave`: 18 recent commits since Oct-6 by `norvan`, focused on
  local multiplayer/controller and altered gameplay.
- `Panda-995`: 4 commits beyond `zgjzgj1985`'s mobile baseline, one committer.
- `zgjzgj1985`: two Oct-6 commits by one author; earlier mobile/performance work.
- `JONIMONI09`: 27 commits including merges since Oct-6 by Jonas. Merge count is
  not equivalent to independent contributions or multiple active maintainers.
- `gzbin7878at2016`: recent history uses one committer identity, mainly documentation.

No candidate reviewed demonstrates sustained maintenance by a larger team.
Continue selective patch review rather than designate an unverified new upstream.
