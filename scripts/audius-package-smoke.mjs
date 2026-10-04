import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const output = resolve('.runtime/audius-package'); mkdirSync(output, { recursive: true });
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const env = { ...process.env, FOCUSSPACE_DATA_DIR: mkdtempSync(resolve(output, 'data-')) }; delete env.ELECTRON_RUN_AS_NODE; delete env.FOCUSSPACE_LEGACY;
const report = { version: manifest.version, assertions: [] }; let app;
try {
  app = await electron.launch({ executablePath: resolve(process.env.FOCUSSPACE_PACKAGE_DIR ?? manifest.build.directories.output, 'win-unpacked/FocusSpace.exe'), env });
  await app.evaluate(() => { const original = globalThis.fetch; globalThis.fetch = (url, options) => String(url).startsWith('https://ccmixter.org/api/query') ? Promise.resolve(new Response('[]')) : original(url, options); });
  await app.evaluate(({ BrowserWindow }, data) => {
    const debug = BrowserWindow.getAllWindows()[0].webContents.debugger; debug.attach('1.3');
    debug.on('message', (_event, method, params) => {
      if (method !== 'Fetch.requestPaused') return;
      const streaming = params.request.url.includes('/stream?'); const bytes = Buffer.from(streaming ? data.audio : data.metadata, 'base64');
      void debug.sendCommand('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: streaming ? 'audio/mpeg' : 'application/json' }, { name: 'Content-Length', value: String(bytes.length) }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: bytes.toString('base64') });
    });
    return debug.sendCommand('Fetch.enable', { patterns: [{ urlPattern: 'https://api.audius.co/v1/tracks/*' }] });
  }, { audio: readFileSync('tests/fixtures/original-long-tone.mp3').toString('base64'), metadata: Buffer.from(JSON.stringify({ data: [{ id: 'packaged', title: 'Packaged frequency', user: { name: 'Fixture artist' } }] })).toString('base64') });
  const page = await app.firstWindow(); await page.route('https://archive.org/**', route => route.fulfill({ json: { response: { docs: [] } } })); await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [] } })); await page.getByRole('combobox', { name: 'Search free music', exact: true }).fill('frequency'); await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click(); await page.getByRole('button', { name: 'Stream Packaged frequency by Fixture artist', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0); await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause Audius audio', exact: true }).click(); expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  report.assertions.push('Packaged Audius search -> actual MP3 fixture streaming -> pause stays inside FocusSpace without video.');
  report.assertions.forEach(value => console.log(`PASS ${value}`));
} finally { if (app) await app.close(); writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); }
