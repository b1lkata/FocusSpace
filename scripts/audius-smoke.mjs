import { chromium, expect, _electron as electron } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
const output = resolve('.runtime/audius'); mkdirSync(output, { recursive: true });
const report = { assertions: [], errors: [], publicNetwork: 'unverified' }; const mp3 = readFileSync('tests/fixtures/original-long-tone.mp3');
const tracks = [{ id: 'first', title: 'First frequency', user: { name: 'Fixture artist' }, duration: 3 }, { id: 'second', title: 'Second frequency', user: { name: 'Fixture artist' }, duration: 3 }, { id: 'paid', title: 'Restricted track', user: { name: 'Fixture artist' }, is_stream_gated: true }];
const fixture = createServer((request, response) => { if (request.url.startsWith('/stream')) { response.setHeader('Content-Type', 'audio/mpeg'); response.end(mp3); } else { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ data: tracks })); } });
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve)); const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true }); let app;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } }); const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [] } }));
  await page.route('https://archive.org/**', route => route.fulfill({ json: { response: { docs: [] } } }));
  await page.route('**/api/ccmixter?**', route => route.fulfill({ json: [] }));
  await page.route('https://api.audius.co/v1/tracks/**', route => {
    if (!route.request().url().includes('/stream?')) return route.fulfill({ json: { data: tracks } });
    const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/); const start = range ? Number(range[1]) : 0; const end = range?.[2] ? Math.min(Number(range[2]), mp3.length - 1) : mp3.length - 1; const body = mp3.subarray(start, end + 1);
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/mpeg', headers: { 'accept-ranges': 'bytes', 'content-length': String(body.length), ...(range ? { 'content-range': `bytes ${start}-${end}/${mp3.length}` } : {}) }, body });
  });
  await page.goto('http://127.0.0.1:4173/'); await expect(page.getByRole('combobox', { name: 'Search free music', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Search free music', exact: true }).fill('frequency'); await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.locator('.catalog-track')).toHaveCount(2);
  const before = page.url(); await page.getByRole('button', { name: 'Stream First frequency by Fixture artist', exact: true }).click();
  await expect.poll(() => page.locator('.audio-library audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0); expect(context.pages().length).toBe(1); expect(page.url()).toBe(before); await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('.viewport-companion')).toHaveClass(/dancing/);
  await page.getByRole('button', { name: 'Stream First frequency by Fixture artist', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  await expect(page.locator('.viewport-companion')).not.toHaveClass(/dancing/);
  await page.getByRole('button', { name: 'Stream First frequency by Fixture artist', exact: true }).click();
  await expect(page.locator('.audio-current')).toContainText('Streaming from Audius'); await page.getByRole('button', { name: 'Pause Audius audio', exact: true }).click();
  await page.getByRole('slider', { name: 'Audio position', exact: true }).fill('1.1'); await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(1.1, 1);
  await page.getByRole('button', { name: 'Next audio track', exact: true }).click(); await expect(page.locator('audio')).toHaveAttribute('src', /tracks\/second\/stream/); await expect(page.locator('.audio-current')).toContainText('Second frequency');
  await page.getByRole('button', { name: 'Play ambient loop', exact: true }).first().click(); await expect.poll(() => page.locator('audio').evaluate(audio => audio.paused)).toBe(true); await page.getByRole('button', { name: 'Pause ambient loop', exact: true }).first().click();
  report.assertions.push('Audius is default; search excludes gated tracks; stream plays actual MP3 here, with seek, queue and ambient mutual exclusion, no tabs or video.');
  await page.getByRole('button', { name: 'Stream First frequency by Fixture artist', exact: true }).click(); await page.getByRole('button', { name: 'Pause Audius audio', exact: true }).click();
  await page.locator('.audio-library').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, 'desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: resolve(output, 'mobile.png') });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); report.accessibility = { violations: audit.violations.map(item => item.id), incomplete: audit.incomplete.map(item => item.id) }; expect(report.accessibility.violations).toEqual([]);
  await page.route('https://api.audius.co/v1/tracks/**', route => route.fulfill({ status: 403, body: 'Denied' })); await page.getByRole('combobox', { name: 'Search free music' }).fill('lofi'); await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.locator('#song-suggestions').getByRole('status')).toContainText('Audius is unavailable'); await expect(page.locator('.catalog-track')).toHaveCount(0);
  report.assertions.push('Small viewport/accessibility pass; rejected provider access is clear and no fake results remain.');
  const network = await context.newPage(); await network.goto('http://127.0.0.1:4173/');
  report.publicNetwork = await network.evaluate(async () => { try { const response = await fetch('https://api.audius.co/v1/tracks/trending?app_name=FocusSpace&limit=2', { signal: AbortSignal.timeout(15000) }); const body = await response.text(); return { status: response.status, body: body.slice(0, 250), livePlayback: 'unverified' }; } catch (error) { return { state: 'unverified', reason: String(error) }; } });
  try {
    await network.getByRole('combobox', { name: 'Search free music' }).fill('lofi'); await network.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click();
    const song = network.getByRole('button', { name: /^Stream / }).first(); await song.waitFor({ timeout: 20000 }); const title = await song.getAttribute('aria-label'); await song.click();
    await expect.poll(() => network.locator('audio').evaluate(audio => ({ time: audio.currentTime, paused: audio.paused })), { timeout: 20000 }).toMatchObject({ paused: false });
    await expect.poll(() => network.locator('audio').evaluate(audio => audio.currentTime), { timeout: 20000 }).toBeGreaterThan(0);
    report.publicNetwork.livePlayback = { state: 'playing', title, time: await network.locator('audio').evaluate(audio => audio.currentTime) };
    await network.screenshot({ path: resolve(output, 'public-stream.png') });
  } catch (error) { report.publicNetwork.livePlayback = { state: 'unverified', reason: error.message.slice(0, 400) }; }
  await network.close();
  const env = { ...process.env, FOCUSSPACE_DATA_DIR: mkdtempSync(resolve(output, 'desktop-data-')) }; delete env.ELECTRON_RUN_AS_NODE; delete env.FOCUSSPACE_LEGACY;
  app = await electron.launch({ executablePath: resolve('node_modules/electron/dist/electron.exe'), args: [resolve('dist/main/main.cjs')], env });
  await app.evaluate(({ BrowserWindow }, data) => {
    const debug = BrowserWindow.getAllWindows()[0].webContents.debugger; debug.attach('1.3');
    debug.on('message', (_event, method, params) => {
      if (method !== 'Fetch.requestPaused') return;
      const streaming = params.request.url.includes('/stream?'); const bytes = Buffer.from(streaming ? data.audio : data.metadata, 'base64');
      const headers = [{ name: 'Content-Type', value: streaming ? 'audio/mpeg' : 'application/json' }, { name: 'Content-Length', value: String(bytes.length) }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Accept-Ranges', value: 'bytes' }];
      void debug.sendCommand('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200, responseHeaders: headers, body: bytes.toString('base64') });
    });
    return debug.sendCommand('Fetch.enable', { patterns: [{ urlPattern: 'https://api.audius.co/v1/tracks/*' }] });
  }, { audio: mp3.toString('base64'), metadata: Buffer.from(JSON.stringify({ data: tracks })).toString('base64') });
  const desktop = await app.firstWindow(); await desktop.getByRole('combobox', { name: 'Search free music', exact: true }).fill('frequency'); await desktop.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click(); await desktop.getByRole('button', { name: 'Stream First frequency by Fixture artist', exact: true }).click(); await expect.poll(() => desktop.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0); report.assertions.push('Desktop Audius route plays MP3 through the same player using explicit local response fixtures.');
  expect(report.errors).toEqual([]); report.assertions.forEach(value => console.log(`PASS ${value}`)); console.log(`Public Audius: ${JSON.stringify(report.publicNetwork)}`);
} finally { if (app) await app.close(); await browser.close(); await new Promise(resolve => fixture.close(resolve)); writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); }
