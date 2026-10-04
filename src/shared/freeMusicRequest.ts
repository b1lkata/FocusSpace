import { request } from 'node:https';
export function fetchMixter(query: string, discover: boolean): Promise<unknown> {
  const url = new URL('https://ccmixter.org/api/query');
  url.searchParams.set('f', 'json'); url.searchParams.set('limit', '10'); url.searchParams.set('tags', 'remix'); url.searchParams.set('lic', 'by');
  if (!discover) { url.searchParams.set('search', query.slice(0, 200)); url.searchParams.set('search_type', 'all'); }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => req.destroy(new Error('Provider timeout')), 10000);
    const req = request(url, { method: 'GET', maxHeaderSize: 65536 }, response => {
      if (response.statusCode !== 200) { response.resume(); req.destroy(new Error('ccMixter unavailable')); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 2000000) { req.destroy(new Error('Provider response too large')); return; } chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => { clearTimeout(timeout); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Invalid provider response')); } });
    });
    req.on('error', error => { clearTimeout(timeout); reject(error); }); req.end();
  });
}
