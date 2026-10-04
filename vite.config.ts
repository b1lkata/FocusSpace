import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fetchMixter } from './src/shared/freeMusicRequest';
import { jamendoProxy } from './src/shared/jamendoProxy';
function musicProxy(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/ccmixter') { next(); return; }
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
    void fetchMixter(url.searchParams.get('search') ?? '', !url.searchParams.has('search')).then(data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); }).catch(() => { res.statusCode = 502; res.end('{"error":"Provider unavailable"}'); });
  };
  return { name: 'focusspace-fixed-music-proxy', configureServer(server) { server.middlewares.use(jamendoProxy); server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(jamendoProxy); server.middlewares.use(middleware); } };
}
const demoPolicy:Plugin={name:'demo-offline-policy',transformIndexHtml:{order:'pre',handler:html=>html.replace('/src/renderer/main.tsx','/src/renderer/demo.tsx').replace(/connect-src[^;]+;/,"connect-src 'self';").replace(/media-src[^;]+;/,"media-src 'self' blob:;").replace(/img-src[^;]+;/,"img-src 'self' data: blob:;")}};
export default defineConfig(({ mode }) => ({ base: './', publicDir:mode==='demo'?'public-demo':'public', plugins: [react(), ...(mode==='demo'?[demoPolicy]:[musicProxy()])], build: { outDir:mode==='demo'?'dist/demo':['ios', 'android'].includes(mode) ? `dist/${mode}` : mode === 'web-preview' ? 'dist/web-preview' : 'dist/renderer' } }));
