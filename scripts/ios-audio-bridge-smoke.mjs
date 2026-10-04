import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const platform = process.env.FOCUSSPACE_PLATFORM || 'ios';
const output = `.runtime/${platform}-audio-bridge`;  mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { assertions: [], nativeCompilation: 'unverified', devicePlayback: 'unverified' };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(platform => {
    window.CapacitorCustomPlatform = { name: platform };
    const commands = ['play', 'playLocal', 'pause', 'resume', 'stop', 'seek', 'volume', 'skip', 'state', 'removeListener'];
    const fixture = window.audioFixture = { calls: [], queue: [], index: 0, state: { id: '', local: false, playing: false, time: 0, duration: 100 } };
    fixture.emit = value => { Object.assign(fixture.state, value); fixture.listener?.(fixture.state); };
    window.Capacitor = {
      PluginHeaders: [{ name: 'FocusAudio', methods: [...commands.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }] }],
      nativeCallback: async (_plugin, _method, _options, callback) => { fixture.listener = callback; return 'fixture'; },
      nativePromise: async (_plugin, method, options) => {
        fixture.calls.push({ method, options });
        if (method === 'play') { fixture.queue = options.tracks; fixture.index = options.index; fixture.emit({ id: fixture.queue[fixture.index].id, local: false, playing: true, time: 2 }); }
        if (method === 'playLocal') fixture.emit({ id: options.id, local: true, playing: true, time: 1 });
        if (method === 'pause') fixture.emit({ playing: false });
        if (method === 'resume') fixture.emit({ playing: true });
        if (method === 'seek') fixture.emit({ time: options.time });
        if (method === 'skip') { fixture.index = (fixture.index + options.delta + fixture.queue.length) % fixture.queue.length; fixture.emit({ id: fixture.queue[fixture.index].id, playing: true }); }
        if (method === 'state') return fixture.state;
        return {};
      }
    };
  }, platform);
  await page.route('https://api.audius.co/v1/tracks/**', route => route.request().url().includes('/stream?') ? route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-tone.mp3') }) : route.fulfill({ json: { data: [{ id: 'first', title: 'Native first', user: { name: 'Fixture' } }, { id: 'second', title: 'Native second', user: { name: 'Fixture' } }] } }));
  await page.route('https://archive.org/**', route => route.fulfill({ json: { response: { docs: [] } } }));
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [] } }));
  await page.goto(platform === 'android' ? 'http://127.0.0.1:4175/' : 'http://127.0.0.1:4174/');
  await page.getByRole('combobox', { name: 'Search free music' }).fill('Native'); await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Stream Native first by Fixture', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause Audius audio' })).toBeVisible();
  expect(await page.locator('audio').getAttribute('src')).toBeNull();
  const pauses = await page.evaluate(() => window.audioFixture.calls.filter(call => call.method === 'pause').length);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await page.evaluate(() => window.audioFixture.calls.filter(call => call.method === 'pause').length)).toBe(pauses);
  await page.evaluate(() => window.audioFixture.emit({ id: 'second', playing: true, time: 12 }));
  await expect(page.locator('.audio-current')).toContainText('Native second');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('button', { name: 'Pause Audius audio' }).click();
  await page.getByRole('button', { name: 'Play Audius audio' }).click();
  await page.getByRole('slider', { name: 'Audio position' }).fill('25');
  await page.getByRole('slider', { name: 'Local audio volume' }).fill('0.3');
  const calls = await page.evaluate(() => window.audioFixture.calls);
  expect(calls.find(call => call.method === 'play').options.tracks).toHaveLength(2);
  expect(calls.find(call => call.method === 'play').options.tracks[0].url).toMatch(/^https:\/\/api.audius.co\/v1\/tracks\/first\/stream\?/);
  expect(calls.some(call => call.method === 'seek' && call.options.time === 25)).toBe(true);
  expect(calls.some(call => call.method === 'volume' && call.options.volume === .3)).toBe(true);
  report.assertions.push('Mock native bridge receives full queue, pause/resume/seek/volume; hidden page does not pause native audio; native queue state updates the UI without duplicate HTML playback.');
  await page.getByLabel('Import audio files').setInputFiles({ name: 'Native local.mp3', mimeType: 'audio/mpeg', buffer: readFileSync('tests/fixtures/original-tone.mp3') });
  await page.getByRole('button', { name: 'Play audio Native local', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause local audio' })).toBeVisible();
  expect(await page.evaluate(() => window.audioFixture.calls.find(call => call.method === 'playLocal').options.data)).toBe(readFileSync('tests/fixtures/original-tone.mp3').toString('base64'));
  await page.evaluate(() => window.audioFixture.emit({ playing: false, error: 'Native fixture failed' }));
  await expect(page.getByRole('alert')).toContainText('Native fixture failed');
  report.assertions.push('Imported MP3 bytes reach native bridge unchanged; native errors are visible. This mock does not verify native player or screen-lock behavior.');
  console.log(report);
} finally { await browser.close(); writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); }
