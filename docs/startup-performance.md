> Historical experiment, retired on 2026-10-08 by user choice. Runtime now follows upstream; see original-behavior-20261008.md. Do not use these old acceptance criteria for releases.

# Startup performance experiment

Date: 2026-09-29. Base: `6203110964364f50244bf61e3bfd4e322a792346`.
Isolated checkout: `C:/Users/chengziang02/Documents/inkwave-startup`.
Branch: `codex/startup-performance`. No production deployment.

## Follow-up: image/material growth and balanced defaults

Implemented after the initial measurements below:

- Fresh profiles now default to the existing Medium preset. Existing saved choices,
  including High, remain unchanged. This is a balanced default, not a new GPU
  classifier or an Auto quality preset. The existing dynamic-resolution controller
  remains in use; no high-cost effects are enabled mid-round by this change.
- Removed `_preloadStages()` and its calls. Main menu requests only the backdrop
  image; setup requests visible small images and the selected hero image. Ticket
  images use native lazy loading and asynchronous decoding.
- SVG thumbnails are generated on first use and cached, instead of all at boot.
- The procedural library preserves stable layer indices but compiles/generates
  only common materials plus the chosen stage's owned materials. `ensureStage()`
  serializes requests, fills missing layers on a later map change and reuses them
  on return. The full-library API remains available for art-generation tools.
  This saves generation work, not array allocation: GPU storage still reserves
  all 28 layers. Original shared marina materials remain in the common pack.

`tools/test-startup-performance.mjs` passed these browser checks: fresh Medium,
no renderer on main menu, exactly one stage image request on main menu, native
settings High selection before world load, persisted High after refresh, setup
does not request Cargo or unselected full-size hero images. A 64x64 GPU comparison
of all three attachments for a common material and all Cargo materials found zero
different bytes versus full generation. Initial generated layers were 25; concurrent
Cargo requests filled to 28; a subsequent return request remained at 28. This is a
targeted pixel check, not a visual equivalence claim for all devices/resolutions.
The final test asserts every sampled attachment is nonempty and rejects WebGL
errors. Readback uses `normal.renderTarget`: Three's array-target constructor does
not retain that pointer on the replaced attachment-zero texture.

Fresh browser measurements on the same RTX 5070, each observed once:

| Follow-up run | Menu observed | Playing observed from navigation | Texture generation | Transferred through sample |
| --- | ---: | ---: | ---: | ---: |
| Default Medium | 0.58 s | 27.42 s | 5.02 s, 256 px | 2.24 MB |
| Explicit High | 0.51 s | 32.60 s | 6.54 s, 512 px | 2.24 MB |

The earlier retained-audio High run observed playing at 44.92 seconds and roughly
4.71 MB transferred. Hardware contention and driver caches vary, so do not treat
these single samples as guaranteed speedups. Initial main-menu stage image count
decreased deterministically from 16 to 1. High's quality preset was not reduced.
Full first-play latency is still substantial and requires further work.

The follow-up Cargo two-client Low-quality full match also passed: both entered
playing after 34.9 seconds, matching rosters/KD and results, clock spread 0.09 seconds
in the sample, and both returned to the lobby. This exercises the stage-owned
material path in a real online-only map. It does not validate asymmetric slow-client
readiness, which remains a release gate below.

Run `node tools/test-startup-performance.mjs` for the follow-up checks, and use
`--quality high` with the benchmark to keep quality fixed when comparing versions.

## Findings

The loading bar covers substantial local rendering work, not just downloads.
`main.js` builds the arena and environment, generates procedural texture arrays,
creates an eight-actor attract match, compiles shaders, and renders three frames
before exposing the menu. High quality uses the existing expensive render settings.

`world/texlib.js` compiles procedural generator programs, renders every material
layer, then synchronously reads a pixel to wait for the GPU. Local measurements
put this stage at approximately 5–10.2 seconds on an RTX 5070. Removing the readback
alone would mostly move the wait elsewhere; it does not remove the GPU work.
Character variants also have their own warm-up in `_warmCharacters()`.

## Reference approaches

- [PlayCanvas loading sequence](https://developer.playcanvas.com/user-manual/optimization/load-time/):
  minimum preload, title/customization, then main game; load assets by phase and
  optionally show placeholders while detail becomes available.
- [Web.dev long tasks](https://web.dev/articles/optimize-long-tasks): split CPU work
  and yield to the browser. A promise/microtask alone is not a rendering opportunity.
  Moving work behind the menu is insufficient if it immediately blocks interaction.
- [Three.js compileAsync](https://threejs.org/docs/pages/WebGLRenderer.html):
  asynchronous shader compilation uses KHR_parallel_shader_compile. This project
  already uses it. Adding another call is not a solution to its total startup cost.
- [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html): GPU texture
  compression can reduce texture memory, but requires a content pipeline and
  device-dependent transcoding. This experiment has not converted the material arrays.

## Implemented locally

- Existing native title/menu/settings appear before WebGL context or world creation.
- The existing stage illustration replaces the live attract match on first entry.
- Audio modules remain available to native menu interactions.
- World initialization is shared through one promise, invoked by offline/online
  match entry or a first visit to the loadout/locker 3D preview.
- Initial attract actors are not created. Match settings and quality values are unchanged.
- Guarded menu-only input/settings/return paths against missing rendering systems.
- Reused the existing loading screen and provided a visible initialization error.
- Added a repeatable fresh-browser benchmark, with optional CPU throttling and preview flow.

This does not start heavy background preparation after showing the menu. The current
world generator has multi-second tasks that would make the menu freeze again.

## Measurements and checks

Chrome headless, Windows, RTX 5070 / ANGLE D3D11, viewport 1280x720, default High,
local static server. Each benchmark starts a new browser profile; this does not
guarantee clearing OS/driver shader caches. Shared-machine load varied, so these
are individual observations, not percentiles or weak-device acceptance.

| Run | Navigation to observed main menu | Other evidence |
| --- | ---: | --- |
| Baseline | 42.39 s | Boot marker 33.60 s; settings click observation 2.25 s |
| Initial staged | 0.64 s | No WebGL renderer yet; entered offline playing state; no page errors |
| Preview flow | 0.67 s | Locker initialized, returned to menu, then entered offline playing state; no page errors |
| Direct staged repeat | 2.11 s | Playing observed at 40.74 s from navigation; no page errors |
| Final, menu audio retained | 2.60 s | Playing observed at 44.92 s from navigation; no page errors |

The first baseline/staged reports took their final snapshot after a 2.5-second
stability sample: 53.41 / 30.03 seconds from navigation. Those final snapshot times
must NOT be called exact first-playable times. The benchmark now records
`playingObservedAt` before the stability sample. This observes game state, not
physical input-to-photon latency.

A four-times CPU-throttled menu run observed 3.24 seconds, without a renderer.
It overlapped another local GPU test and is only a stress observation; it does
not establish a low-end hardware target.

Two-client Low-quality local relay full-flow test passed: room create/join, both
playing, consistent roster/KD, clock spread 0.11 s in the sample, matching results,
and both returning to the lobby. Cold match preparation took 42.7 s with both
clients sharing one GPU. This validates the ordinary flow, not asymmetric slow clients.

Build and JavaScript syntax checks passed. Benchmark reports/screenshots are in
ignored `.local/startup/`. Server configuration and production files were not changed.

## Remaining work before release

1. Integrate with the parent branch's native settings/i18n changes. This experiment
   intentionally starts from the deployed baseline and still has its old translation
   adapter. Do not overwrite the active parent checkout or deploy this copy wholesale.
2. Separate the standalone character/showcase renderer from the arena. At present,
   the first loadout/locker visit still prepares the whole world. The initial online
   hub/lobby has no 3D showcase before world initialization.
3. Integrate localized preparation/error copy into the parent's native i18n. The
   readiness protocol is now bounded and tested locally; do not mix old and new
   clients in a release (reload clients when updating the protocol).
4. Prototype offline baking of deterministic material arrays. Measure compressed
   transfer bytes, decode/upload time, memory and pixel equivalence, including
   sRGB albedo, linear normals/ORM, alpha and all layers. Key artifacts to generator
   source/version so upstream material updates cannot silently use stale bakes.
   Prefer incremental stage/quality downloads over a new giant initial pack.
5. Profile individual character variants and render passes. Stage their preparation
   without leaving first combat actions to trigger compilation stalls.
6. Measure real integrated GPUs/mobile devices and slow networks. Choose defaults
   from measured frame time/memory, preserve a manual quality override, and avoid
   treating CPU throttling as GPU emulation.

## Reproduction

From this checkout, install root and `server-node` dependencies and run
`node tools/build-assertok.mjs`. Start `server-node/index.js` with `PORT=8492`,
`STATIC_ROOT` pointing at this checkout's `dist`, and `ALLOWED_ORIGINS` containing
`http://127.0.0.1:8492`. Check that the port is unused first.

```text
node tools/benchmark-startup.mjs --name menu
node tools/benchmark-startup.mjs --name direct --start
node tools/benchmark-startup.mjs --name preview --start --preview
node tools/benchmark-startup.mjs --name cpu4 --cpu 4
node tools/net-test-assertok.mjs --url http://127.0.0.1:8492/ --clients 2 --quality low --secs 8 --full
```

`CHROME_PATH` overrides the Windows Chrome executable. Keep benchmark browser runs
serial for more comparable timings. Do not compare the preview run's total time
with the direct-to-match run: they execute different user journeys.

## Resource preparation and settings follow-up

The renderer owns graphics resource lifetime; the game owns stage preparation;
NetSession owns network orchestration; `net/preparation.js` owns the host's pure
readiness policy. No menu DOM hooks are used for these changes.

- Shadow and bloom toggles reuse the composer. Shadows retain shader variants and
  allocated maps, but disable shadow updates and contribution. This intentionally
  trades retained memory for predictable toggle latency. Quality changes dispose
  owned passes and targets, including materials omitted by upstream pass disposal.
- Heavy quality changes are coalesced and applied before the next match. Texture
  library resolution, paint atlas, shadow size, FX quality and postprocessing are
  rebuilt together. Existing explicit quality preferences remain; new profiles
  default to Medium. There is no automatic GPU quality classifier.
- Procedural layers yield between tasks. GPU completion uses asynchronous readback
  for material preparation and a fence before entering a match. Selected lightmap
  metadata, hash and texture must succeed. Character preparation no longer races
  an eight-second forced continuation. Cancellation never starts a match later.
- The host starts immediately when connected participants are ready. Once a strict
  majority including the host is ready, other clients receive 30 seconds of grace.
  Total preparation is capped at 120 seconds. Valid ready players may start with
  a minority excluded; otherwise the attempt aborts. Humans-only map/team rules
  remain required. Clients have a 130-second lost-host fallback. These are initial
  policy constants, not device performance claims.
- Exclusions travel in the authoritative go message. Every ready peer uses the
  existing onLeave bot/removal behavior; excluded clients cannot enter this match
  or send accepted replication messages. No late-join state synchronization was added.

Local Chrome/RTX 5070 evidence: six shadow/bloom toggles reused the composer,
textures stayed 46, click handlers took 0.1–0.3 ms, and maximum sampled frame gaps
were approximately 17 ms. This addresses the previously measured 12.5-second
shadow-toggle stall; it does not establish performance on low-end hardware.
A blocked warm-up remained in loading after nine seconds; selecting Medium while
High was active applied consistent Medium resources before the next map. A failed
lightmap request prevented entry with a visible error. Material array pixel tests
reported zero mismatches and no empty sampled attachments.

Two real clients with an additional 16-second readiness delay completed a full
match and returned to the lobby. Clock spread was 0.04 seconds and final results
agreed. Readiness policy tests cover minority delays, missing host, missing majority,
disconnects and map restrictions. Browser exclusion and cancellation tests passed and are
available in `tools/test-net-preparation.mjs` and `tools/test-graphics-readiness.mjs`.

First entry still includes costly procedural generation and shader compilation.
The latest single Medium run reached the menu in 0.61 s and playing in 31.17 s,
with a 2.84 s maximum long task. Further baking/worker experiments need measured
tradeoffs; moving the same synchronous GPU work into a Promise is not a solution.
This branch is local-only and is not a production deployment.
