import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchJamendo, jamendoQuery } from './jamendo';
export function jamendoProxy(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/api/jamendo') { next(); return; }
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') { res.statusCode = 405; res.end('{"error":"Method unavailable"}'); return; }
  try {
    const options = jamendoQuery.parse({ query: url.searchParams.get('query') ?? '', discover: url.searchParams.get('discover') === 'true', offset: Number(url.searchParams.get('offset') ?? 0), ...(url.searchParams.has('artistId') ? { artistId: url.searchParams.get('artistId') } : {}), ...(url.searchParams.has('albumId') ? { albumId: url.searchParams.get('albumId') } : {}), ...(url.searchParams.has('group') ? { group: url.searchParams.get('group') } : {}) });
    void fetchJamendo(process.env.JAMENDO_CLIENT_ID, options).then(data => res.end(JSON.stringify(data))).catch(() => { res.statusCode = 502; res.end('{"error":"Jamendo unavailable"}'); });
  } catch { res.statusCode = 400; res.end('{"error":"Invalid music query"}'); }
}
