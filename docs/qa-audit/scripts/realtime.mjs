import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const b = 'http://127.0.0.1:3100';
const H = (r) => ({ authorization: 'Bearer ' + t[r], 'content-type': 'application/json' });
// Проєкт, де andrii (freelancer) — учасник
const projects = await (await fetch(b + '/projects?limit=50', { headers: H('freelancer') })).json();
const p = (projects.items ?? projects).find((x) => x.status === 'ACTIVE');
console.log('shared ACTIVE project found:', Boolean(p));
const ctrl = new AbortController();
const events = [];
const stream = fetch(`${b}/projects/${p.id}/messages/stream`, { headers: H('client'), signal: ctrl.signal }).then(async (r) => {
  console.log('client SSE status', r.status, r.headers.get('content-type'));
  const reader = r.body.getReader(); const dec = new TextDecoder();
  for (;;) { const { value, done } = await reader.read(); if (done) break; events.push(dec.decode(value)); }
}).catch(() => {});
const notif = [];
fetch(`${b}/notifications/stream`, { headers: H('client'), signal: ctrl.signal }).then(async (r) => { const rd = r.body.getReader(); const dec = new TextDecoder(); for (;;) { const { value, done } = await rd.read(); if (done) break; notif.push(dec.decode(value)); } }).catch(() => {});
await new Promise((r) => setTimeout(r, 800));
await fetch(`${b}/projects/${p.id}/typing`, { method: 'POST', headers: H('freelancer') });
const t0 = Date.now();
const sent = await (await fetch(`${b}/projects/${p.id}/messages`, { method: 'POST', headers: H('freelancer'), body: JSON.stringify({ content: 'QA realtime ' + t0 }) })).json();
for (let i = 0; i < 30 && !events.join('').includes('QA realtime ' + t0); i++) await new Promise((r) => setTimeout(r, 100));
const got = events.join('');
console.log('typing event delivered:', got.includes('typing'));
console.log('message delivered in', got.includes('QA realtime ' + t0) ? Date.now() - t0 + 'ms' : 'NOT delivered');
await fetch(`${b}/projects/${p.id}/messages/${sent.id}`, { method: 'DELETE', headers: H('freelancer') });
await new Promise((r) => setTimeout(r, 500));
console.log('delete event delivered:', events.join('').includes('deleted'));
await new Promise((r) => setTimeout(r, 600));
console.log('notification push delivered:', notif.join('').length > 0);
// Ізоляція: стороння сесія не може підписатися на чужий потік
const other = await fetch(`${b}/projects/${p.id}/messages/stream`, { headers: H('admin') });
console.log('admin SSE on private chat:', other.status);
// Два одночасні takeNext / дві одночасні перевірки — гонки
ctrl.abort();
process.exit(0);
