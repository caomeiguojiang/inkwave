# Startup performance experiment

Date: 2026-09-29. Base: `6203110964364f50244bf61e3bfd4e322a792346`.
Isolated checkout: `C:/Users/chengziang02/Documents/inkwave-startup`.
Branch: `codex/startup-performance`. No production deployment.

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
3. Harden slow-client readiness. `net/session.js` has a 12-second forced-go timer
   after a readiness event. Moving cold initialization into match entry increases
   the chance of a late client; test deliberately asymmetric clients and buffer
   early go messages or revise the readiness protocol before production rollout.
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
