import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import * as THREE from 'three';
import { NetMatch } from '../src/net/netmatch.js';
import { initFxHooks } from '../src/fx/fxHooks.js';

function fixture(wait = 2, newSpawn = true) {
  const nm = Object.create(NetMatch.prototype);
  const peer = { tr: 10, rate: 1, delay: 0.1 };
  nm._peer = () => peer;
  nm.stats = { extrap: 0, snaps: 0 };
  const sample = (t, tp, x) => ({ t, tp, x, y: 0, z: 0, vx: 0, vy: 0, vz: 0, f: 16,
    yaw: 0, aimYaw: 0, aimPitch: 0, hp: 100, ink: 100, sp: 0, ch: 0, turf: 0,
    wx: 0, wy: 0, wz: 1, lock: 0, ks: 0, spx: 0, spst: 0 });
  const a = { owner: 'host', net: { buf: [sample(10, 0, 3)], tp: 0, deathTp: 0,
    err: new THREE.Vector3(), spawnPending: true, spawnAt: performance.now() / 1000 - wait } };
  if (newSpawn) a.net.buf.push(sample(20, 1, 50));
  return { nm, a, peer };
}

test('late respawn recovers to the buffered spawn and cannot rewind on the following frame', () => {
  const { nm, a, peer } = fixture();
  nm._sample(a, 0, 1 / 60);
  assert.equal(a.net.cur.tp, 1);
  assert.equal(a.net.cur.x, 50);
  assert.equal(a.net.err.lengthSq(), 0);
  assert.equal(peer.tr, 10, 'another actor sharing this clock must not jump');
  a.net.spawnPending = false; // applyRemote completes the visible spawn
  peer.tr += 1 / 60;
  nm._sample(a, 0, 1 / 60);
  assert.equal(a.net.cur.tp, 1);
  assert.equal(a.net.cur.x, 50);
});

test('normal respawn still waits for its playback timestamp', () => {
  const { nm, a, peer } = fixture(0.1);
  nm._sample(a, 0, 1 / 60);
  assert.equal(a.net.cur.tp, 0);
  assert.equal(a.net.buf.length, 2);
  peer.tr = 20;
  nm._sample(a, 0, 1 / 60);
  assert.equal(a.net.cur.tp, 1);
});

test('deadline alone cannot reveal an actor without post-respawn data', () => {
  const { nm, a } = fixture(10, false);
  nm._sample(a, 0, 1 / 60);
  assert.equal(a.net.cur.tp, a.net.deathTp);
  assert.equal(a.net.spawnPending, true);
});

test('non-respawning actor keeps the ordinary interpolation path', () => {
  const { nm, a } = fixture();
  a.net.spawnPending = false;
  nm._sample(a, 0, 1 / 60);
  assert.equal(a.net.cur.tp, 0);
  assert.equal(a.net.buf.length, 2);
});

test('live FX hooks do not keep finished-round actors alive', async () => {
  assert.equal(typeof global.gc, 'function', 'run with node --expose-gc --test');
  const hooks = initFxHooks({});
  const refs = Array.from({ length: 16 }, () => {
    const actor = { character: { bones: new Float32Array(1024) } };
    hooks.st.set(actor, { actor });
    hooks.flickT.set(actor, 1);
    return new WeakRef(actor);
  });
  for (let i = 0; i < 8; i++) { await setImmediate(); global.gc(); }
  assert.ok(refs.every(ref => ref.deref() === undefined));
  const live = {};
  hooks.st.set(live, { frames: 3 });
  global.gc();
  assert.equal(hooks.st.get(live).frames, 3);
});
