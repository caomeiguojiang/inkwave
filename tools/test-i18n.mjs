import test from 'node:test';
import assert from 'node:assert/strict';
import { matchLanguage } from '../src/i18n/runtime.js';
import { readFileSync } from 'node:fs';
test('browser locale negotiation',()=>{
  for (const [input,expected] of [['zh-CN','zh-Hans'],['zh-SG','zh-Hans'],['zh-Hans-TW','zh-Hans'],['zh-TW','zh-Hant'],['zh-HK','zh-Hant'],['zh-MO','zh-Hant'],['ja-JP','ja'],['en-GB','en'],['de-DE','en']]) assert.equal(matchLanguage([input]),expected,input);
  assert.equal(matchLanguage(['fr','ja','en']),'ja');
  assert.equal(matchLanguage(['en-US','zh-CN']),'en');
});
test('release preserves identifiers and names; localizes presentation only',()=>{
  const menus=readFileSync('dist/src/ui/menus.js','utf8');
  assert.ok(menus.includes("'Room not found':"));
  assert.ok(menus.includes('__iwT("PLAY")'));
  assert.ok(menus.includes('tagTitle(name)'));
  const tr=readFileSync('dist/src/net/transport.js','utf8');
  assert.ok(!tr.includes('inkwave-net.inkwave.workers.dev'));
  assert.ok(tr.includes('location.host'));
});
