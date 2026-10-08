// Protocol-compatible standalone adapter for server/src/index.js (fork PROTO=3).
// Rooms are ephemeral. Restarting the service disconnects matches; no player data is stored.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';

export function createRelay({ origins = ['http://localhost:8490', 'http://127.0.0.1:8490'], maxRooms = 64, maxConnections = 256, maxPerIP = 24, silentMatch = 20000, silentLobby = 150000, sweepMs = 4000, trustProxy = false, staticRoot = null } = {}) {
  const allowed = new Set(origins), rooms = new Map(), peers = new Set(), ips = new Map();
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (req.url === '/health') { res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'}); res.end('ok'); return; }
    if (staticRoot) try {
      const pathname = decodeURIComponent(new URL(req.url,'http://static').pathname);
      const pieces = pathname.split('/');
      if (pieces.some(p => p.startsWith('.')) || pathname.includes('\\') || pathname.includes('\0')) throw Error('invalid');
      const root = resolve(staticRoot), file = resolve(root,'.'+(pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root+sep)) throw Error('outside');
      const info = await stat(file); if (!info.isFile()) throw Error('not file');
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml'};
      res.setHeader('Content-Type',types[extname(file)] || 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
      res.setHeader('Vary','Accept-Encoding');
      let served=file, size=info.size;
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) try { const gz=await stat(file+'.gz'); served=file+'.gz'; size=gz.size; res.setHeader('Content-Encoding','gzip'); } catch { /* raw */ }
      res.setHeader('Content-Length',size); res.writeHead(200);
      if (req.method === 'HEAD') res.end(); else createReadStream(served).on('error',()=>res.destroy()).pipe(res);
      return;
    } catch { /* fail closed; never serve source or directory listings */ }
    res.writeHead(404, { 'Content-Type':'text/plain', 'Cache-Control':'no-store' }); res.end('Not found');
  });
  const wss = new WebSocketServer({ noServer:true, maxPayload:65536, perMessageDeflate:false });
  const send = (ws, data) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); return; }
    ws.send(typeof data === 'string' ? data : JSON.stringify(data));
  };
  const remove = (ws) => {
    if (!peers.delete(ws)) return;
    const count = (ips.get(ws.ip) || 1) - 1;
    if (count) ips.set(ws.ip, count); else ips.delete(ws.ip);
    const room = ws.room;
    if (!room || !room.members.delete(ws.id)) return;
    if (!room.members.size) rooms.delete(room.code);
    else for (const p of room.members.values()) send(p, {t:'leave',id:ws.id,host:room.members.keys().next().value});
  };
  server.on('upgrade', (req, socket, head) => {
    const reject = code => { socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
    let url; try { url = new URL(req.url, 'http://relay'); } catch { reject('400 Bad Request'); return; }
    if (!allowed.has(req.headers.origin)) { reject('403 Forbidden'); return; }
    const m = /^\/room\/([A-Za-z0-9]{4,8})$/.exec(url.pathname);
    if (!m) { reject('404 Not Found'); return; }
    // Only enable behind a loopback-only port; OpenResty must overwrite X-Real-IP.
    const ip = trustProxy ? String(req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress;
    if (wss.clients.size >= maxConnections || (ips.get(ip) || 0) >= maxPerIP) { reject('429 Too Many Requests'); return; }
    wss.handleUpgrade(req, socket, head, ws => {
      peers.add(ws); ws.ip = ip; ips.set(ip, (ips.get(ip) || 0) + 1);
      ws.on('close', () => remove(ws)); ws.on('error', () => { remove(ws); ws.terminate(); });
      const fail = (c, e) => { send(ws, {t:'err',c,e}); ws.close(4000,e); remove(ws); };
      const code = m[1].toUpperCase(), create = url.searchParams.get('create') === '1';
      let room = rooms.get(code);
      if (url.searchParams.get('v') !== '3') return fail('ERR_STALE', 'Please refresh the page — the game was updated');
      if (create && room) return fail('ERR_CODE_TAKEN', 'Room code taken');
      if (!create && !room) return fail('ERR_NOT_FOUND', 'Room not found');
      if (room?.members.size >= 8) return fail('ERR_FULL', 'Room is full');
      if (room?.locked) return fail('ERR_IN_PROGRESS', 'Match in progress');
      if (!room) {
        if (rooms.size >= maxRooms) return fail('ERR_BUSY', 'Server is busy. Try again later.');
        room = {code,locked:false,members:new Map()}; rooms.set(code,room);
      }
      do { ws.id = randomBytes(3).toString('hex').toUpperCase(); } while (room.members.has(ws.id));
      ws.name = (url.searchParams.get('name') || 'Player').replace(/[^\p{L}\p{N} ._\-!?']/gu,'').slice(0,16) || 'Player';
      ws.room = room; ws.seen = Date.now(); ws.window = ws.seen; ws.count = 0; ws.strikes = 0;
      room.members.set(ws.id,ws);
      send(ws,{t:'welcome',id:ws.id,host:room.members.keys().next().value,members:[...room.members.values()].map(p => ({id:p.id,name:p.name}))});
      for (const p of room.members.values()) if (p !== ws) send(p,{t:'join',m:{id:ws.id,name:ws.name}});
      ws.on('message',(data,binary) => {
        if (binary || !peers.has(ws)) return;
        const now = Date.now(); ws.seen = now;
        if (now - ws.window >= 1000) { ws.strikes = ws.count > 90 ? ws.strikes + 1 : Math.max(0,ws.strikes-1); ws.window = now; ws.count = 0; }
        if (++ws.count > 270 || ws.strikes >= 4) { ws.close(4008,'Too many messages'); remove(ws); return; }
        const msg = data.toString();
        if (msg === 'ping') { send(ws,'pong'); return; }
        if (msg.startsWith('b|')) {
          for (const p of room.members.values()) if (p !== ws) send(p,`m|${ws.id}|${msg.slice(2)}`);
        } else if (msg.startsWith('s|')) {
          const k = msg.indexOf('|',2), target = room.members.get(msg.slice(2,k));
          if (k >= 0 && target) send(target,`m|${ws.id}|${msg.slice(k+1)}`);
        } else if (msg.startsWith('{')) {
          let o; try { o = JSON.parse(msg); } catch { return; }
          if (!o || typeof o !== 'object') return;
          if (o.t === 'ping') send(ws,{t:'pong',c:o.c});
          else if (o.t === 'lock' && room.members.keys().next().value === ws.id) room.locked = !!o.v;
        }
      });
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const ws of peers) if (now - ws.seen > (ws.room?.locked ? silentMatch : silentLobby)) { remove(ws); ws.terminate(); }
  },sweepMs); timer.unref();
  return {server, rooms, close: async () => { clearInterval(timer); for (const ws of peers) ws.terminate(); wss.close(); await new Promise(resolve => server.close(resolve)); }};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const relay = createRelay({origins:(process.env.ALLOWED_ORIGINS || 'http://localhost:8490,http://127.0.0.1:8490').split(','),trustProxy:process.env.TRUST_PROXY === '1',staticRoot:process.env.STATIC_ROOT || null});
  relay.server.listen(Number(process.env.PORT || 8787),process.env.HOST || '127.0.0.1',() => console.log('INKWAVE relay listening'));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { await relay.close(); process.exit(0); });
}
