import test from 'node:test';
import assert from 'node:assert/strict';
import { ERR, netError, codeFromRelay, errorMessageKey } from '../src/net/errors.js';
import { changeLanguage, translate } from '../src/i18n/runtime.js';

test('explicit codes win over translated wording; legacy relay messages still work', () => {
 assert.equal(codeFromRelay(ERR.CODE_TAKEN, '房间代码已被占用'), ERR.CODE_TAKEN);
 assert.equal(codeFromRelay(null, 'Room code taken'), ERR.CODE_TAKEN);
 assert.equal(codeFromRelay(null, 'Please refresh the page — the game was updated'), ERR.STALE);
 assert.equal(codeFromRelay(null, 'unrecognised'), ERR.CONNECT);
 assert.equal(netError(ERR.FULL, '房间已满').code, ERR.FULL);
});

test('all exposed failure codes have translated messages in all four languages', async () => {
 for(const lang of ['en','zh-Hans','zh-Hant','ja']) {
  await changeLanguage(lang);
  for(const code of Object.values(ERR).filter(c=>c!==ERR.TEAM_FULL)) {
   const key=errorMessageKey(code, 'MISSING');
   assert.notEqual(key,'MISSING',code);
   const text=translate(key);
   assert.ok(text && !text.startsWith('ERR_'));
   if(lang!=='en') assert.notEqual(text,key,`${lang}: ${code}`);
  }
  assert.ok(translate('special.bubblePrompt',{count:2}).includes('2'));
  assert.ok(translate('special.barragePrompt',{special:'SPECIAL',sub:'SUB'}).includes('SPECIAL'));
 }
 await changeLanguage('en');
});
