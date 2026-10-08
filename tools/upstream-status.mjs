// Fetch and report updates without merging or deploying.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const git = (...args) => execFileSync('git',args,{encoding:'utf8'}).trim();
const url='https://github.com/jaydendavisnc/inkwave.git';
if(git('remote','get-url','upstream')!==url) throw Error('Unexpected upstream URL');
const review=JSON.parse(readFileSync(new URL('../docs/upstream-review.json',import.meta.url),'utf8'));
if(review.repository!==url || !/^[0-9a-f]{40}$/.test(review.last_reviewed_commit)) throw Error('Invalid review checkpoint');
git('fetch','upstream','main');
const head=git('rev-parse','upstream/main');
try {git('merge-base','--is-ancestor',review.last_reviewed_commit,head);} catch {throw Error('Upstream history differs from the reviewed checkpoint; review manually');}
const range=review.last_reviewed_commit+'..'+head;
console.log('Upstream:',head);
console.log('Last reviewed:',review.last_reviewed_commit,'('+review.mode+')');
console.log('New commits requiring review:',git('rev-list','--count',range));
console.log(git('log','--oneline',range) || '(none)');
console.log('Not in Git merge ancestry (may include intentionally adapted/rejected implementations):',git('rev-list','--count','HEAD..'+head));
console.log('Decisions:',review.record,'; policy: docs/UPSTREAM.md');
