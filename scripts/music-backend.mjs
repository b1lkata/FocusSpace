import { createServer } from 'node:http';
import { build } from 'esbuild';
const bundled = await build({ entryPoints: ['src/shared/jamendoProxy.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { jamendoProxy } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const allowed = new Set((process.env.MUSIC_ALLOWED_ORIGINS ?? 'https://localhost,capacitor://localhost').split(',').map(value => value.trim()));
const buckets = new Map();
const server = createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && !allowed.has(origin)) { res.writeHead(403); res.end(); return; }
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET'); res.writeHead(204); res.end(); return; }
  const ip = req.socket.remoteAddress, now = Date.now(), saved = buckets.get(ip);
  const bucket = saved && saved.until > now ? saved : { count: 0, until: now + 60000 }; bucket.count++; buckets.set(ip, bucket);
  if (buckets.size > 256) buckets.delete(buckets.keys().next().value);
  if (bucket.count > 60) { res.writeHead(429); res.end(); return; }
  jamendoProxy(req, res, () => { res.writeHead(404); res.end(); });
});
server.listen(Number(process.env.PORT ?? 4180), process.env.MUSIC_BIND_HOST ?? '127.0.0.1', () => console.log('Tuniko music backend ready; client ID stays on server.'));
