import { preview } from 'vite';

// Local preview only: do not expose the project or publish it externally.
const server = await preview({ mode: 'web-preview', preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
server.printUrls();
console.log('FocusSpace browser preview — local demo; no paid calls.');
