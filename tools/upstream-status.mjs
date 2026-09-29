// Read-only remote update check. Never changes source or deploys automatically.
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git',args,{encoding:'utf8'}).trim();
const url='https://github.com/jaydendavisnc/inkwave.git';
const actual=git('remote','get-url','upstream');
if (actual !== url) throw Error('Review upstream URL before fetching: '+actual);
git('fetch','upstream','main');
console.log('Upstream:',git('rev-parse','upstream/main'));
console.log('Unmerged upstream commits:',git('rev-list','--count','HEAD..upstream/main'));
console.log(git('log','--oneline','HEAD..upstream/main'));
