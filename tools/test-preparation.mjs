import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Preparation } from '../src/net/preparation.js';

test('all ready starts immediately; unknown readiness cannot count', () => {
  const p = new Preparation(['h', 'a'], 'h', 0);
  p.mark('h'); p.mark('unknown');
  assert.equal(p.decide(50000, new Set(['h', 'a'])).action, 'wait');
  p.mark('a');
  assert.equal(p.decide(50001, new Set(['h', 'a'])).action, 'start');
});
test('one slow client gets grace after majority and host readiness', () => {
  const p = new Preparation(['h', 'a', 'b'], 'h', 0);
  p.mark('h'); p.mark('a');
  const connected = new Set(['h', 'a', 'b']);
  assert.equal(p.decide(40000, connected).action, 'wait');
  assert.equal(p.decide(69999, connected).action, 'wait');
  assert.deepEqual(p.decide(70000, connected), { action: 'start', excluded: ['b'], ready: ['h', 'a'] });
});
test('slow host or slow majority aborts rather than forced start', () => {
  for (const ids of [['a', 'b'], ['h']]) {
    const p = new Preparation(['h', 'a', 'b'], 'h', 0);
    ids.forEach(id => p.mark(id));
    assert.equal(p.decide(120000, new Set(['h', 'a', 'b'])).action, 'abort');
  }
});
test('departed players do not hold up a valid room; map restrictions still apply', () => {
  const p = new Preparation(['h', 'a', 'b'], 'h', 0);
  p.mark('h'); p.mark('a');
  assert.equal(p.decide(100, new Set(['h', 'a'])).action, 'start');
  assert.equal(p.decide(120000, new Set(['h', 'a']), () => false).action, 'abort');
});
