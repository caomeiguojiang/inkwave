import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createRelay } from './index.js';
const origin='http://localhost:8490';
async function start(options={}) { const r=createRelay(options); await new Promise(ok=>r.server.listen(0,'127.0.0.1',ok)); r.url=`ws://127.0.0.1:${r.server.address().port}`; return r; }
function connect(r,code='ABCDE',create=false,extra='') {
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(`${r.url}/room/${code}?v=3&name=PLAY${create?'&create=1':''}${extra}`,{origin});
    const queue=[],waiters=[];
    ws.next=()=>queue.length?Promise.resolve(queue.shift()):new Promise((ok,no)=>{const t=setTimeout(()=>no(Error('message timeout')),2000);waiters.push(v=>{clearTimeout(t);ok(v);});});
    ws.on('message',b=>{const s=b.toString();let value=s;try{value=JSON.parse(s);}catch{} if(waiters.length)waiters.shift()(value);else queue.push(value);});
    ws.once('open',()=>resolve(ws));ws.once('error',reject);
  });
}
test('room protocol, targeting, host migration, lock and cleanup',async t=>{
  const r=await start();t.after(()=>r.close());
  const a=await connect(r,'ABCDE',true), aw=await a.next();assert.equal(aw.t,'welcome');assert.equal(aw.members[0].name,'PLAY');
  const b=await connect(r),bw=await b.next();assert.equal(bw.host,aw.id);assert.equal((await a.next()).t,'join');
  a.send('b|hello');assert.equal(await b.next(),`m|${aw.id}|hello`);
  b.send(`s|${aw.id}|private`);assert.equal(await a.next(),`m|${bw.id}|private`);
  b.send('ping');assert.equal(await b.next(),'pong');
  b.send(JSON.stringify({t:'lock',v:true})); b.send('ping');await b.next();assert.equal(r.rooms.get('ABCDE').locked,false);
  a.send(JSON.stringify({t:'lock',v:true}));a.send('ping');await a.next();
  const c=await connect(r);assert.deepEqual(await c.next(),{t:'err',c:'ERR_IN_PROGRESS',e:'Match in progress'});
  a.close();const left=await b.next();assert.equal(left.host,bw.id);assert.equal(left.id,aw.id);
  b.send(JSON.stringify({t:'lock',v:false}));b.send('ping');await b.next();
  const d=await connect(r);assert.equal((await d.next()).host,bw.id);
  b.close();d.close();await new Promise(ok=>setTimeout(ok,30));assert.equal(r.rooms.size,0);
  const e=await connect(r);assert.deepEqual(await e.next(),{t:'err',c:'ERR_NOT_FOUND',e:'Room not found'});
});
test('capacity, protocol and origin boundaries',async t=>{
  const r=await start();t.after(()=>r.close());
  const first=await connect(r,'ABCDE',true);await first.next();
  const duplicate=await connect(r,'ABCDE',true);assert.deepEqual(await duplicate.next(),{t:'err',c:'ERR_CODE_TAKEN',e:'Room code taken'});
  for(let i=0;i<7;i++){const p=await connect(r);assert.equal((await p.next()).t,'welcome');}
  const ninth=await connect(r);assert.deepEqual(await ninth.next(),{t:'err',c:'ERR_FULL',e:'Room is full'});
  await assert.rejects(new Promise((ok,no)=>{const ws=new WebSocket(r.url+'/room/ABCDE?v=3',{origin:'https://evil.invalid'});ws.on('open',()=>{ws.close();ok();});ws.on('error',no);}),/403/);
  const bad=await connect(r,'ZZZZZ',true,'&x=1');assert.equal((await bad.next()).t,'welcome');
});
test('silent host expires and successor is elected',async t=>{
  const r=await start({silentMatch:70,silentLobby:5000,sweepMs:10});t.after(()=>r.close());
  const a=await connect(r,'ABCDE',true);await a.next();const b=await connect(r);const bw=await b.next();await a.next();
  a.send(JSON.stringify({t:'lock',v:true}));
  const timer=setInterval(()=>b.send('ping'),15);t.after(()=>clearInterval(timer));
  let event;do{event=await b.next();}while(event==='pong');assert.equal(event.t,'leave');assert.equal(event.host,bw.id);
});

test('previous clients cannot create or join current rooms',async t=>{
 const r=await start();t.after(()=>r.close());
 for(const query of ['v=1&create=1','v=1','v=2&create=1','v=2','create=1']) {
  const error=await new Promise((resolve,reject)=>{
   const ws=new WebSocket(r.url+'/room/ABCDE?'+query,{origin});
   ws.on('message',data=>{resolve(JSON.parse(data));ws.close();});ws.on('error',reject);
  });
  assert.equal(error.t,'err');assert.equal(error.c,'ERR_STALE');assert.match(error.e,/refresh/);assert.equal(r.rooms.size,0);
 }
});

test('room capacity returns a stable busy code', async t => {
 const r=await start({maxRooms:0});t.after(()=>r.close());
 const ws=await connect(r,'ABCDE',true);
 assert.deepEqual(await ws.next(),{t:'err',c:'ERR_BUSY',e:'Server is busy. Try again later.'});
});
