import test from 'node:test';
import assert from 'node:assert/strict';
import { matchLanguage,changeLanguage,translate,formatMessage } from '../src/i18n/runtime.js';
import { readFileSync } from 'node:fs';
test('browser locale negotiation',()=>{
  for (const [input,expected] of [['zh-CN','zh-Hans'],['zh-SG','zh-Hans'],['zh-Hans-TW','zh-Hans'],['zh-TW','zh-Hant'],['zh-HK','zh-Hant'],['zh-MO','zh-Hant'],['ja-JP','ja'],['en-GB','en'],['de-DE','en']]) assert.equal(matchLanguage([input]),expected,input);
  assert.equal(matchLanguage(['fr','ja','en']),'ja');
  assert.equal(matchLanguage(['en-US','zh-CN']),'en');
});
test('release preserves identifiers and names; localizes presentation only',()=>{
  const menus=readFileSync('dist/src/ui/menus.js','utf8');
  assert.ok(menus.includes("'Room not found':"));
  assert.ok(menus.includes('translate("PLAY")'));
  assert.ok(menus.includes('tagTitle(name)'));
  const tr=readFileSync('dist/src/net/transport.js','utf8');
  assert.ok(!tr.includes('inkwave-net.inkwave.workers.dev'));
  assert.ok(tr.includes('location.host'));
});
test('i18next switches existing configuration labels, interpolates, and falls back',async()=>{
  const {WEAPONS}=await import('../src/config.js');
  await changeLanguage('en'); const english=WEAPONS.shooter.name;
  await changeLanguage('zh-Hans'); assert.notEqual(WEAPONS.shooter.name,english);
  assert.equal(translate('PLAY'),'开始游戏');
  assert.equal(translate('unknown upstream text'),'unknown upstream text');
  assert.ok(formatMessage('{0} joined the room',['PLAY']).includes('PLAY'));
  assert.equal(translate('room.codeRemaining',{count:2}),'还需输入 2 个字符');
  assert.throws(()=>changeLanguage('bad'),RangeError);
  await changeLanguage('en');assert.equal(WEAPONS.shooter.name,english);
  assert.equal(translate('room.codeRemaining',{count:1}),'1 more character to go');
  assert.equal(translate('room.codeRemaining',{count:2}),'2 more characters to go');
});
