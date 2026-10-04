import { _android, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const output = '.runtime/android-emulator'; mkdirSync(output, { recursive: true });
const adb = resolve('.runtime/android-tools/sdk/platform-tools/adb.exe');
const shell = (...args) => execFileSync(adb, ['-s', 'emulator-5554', 'shell', ...args], { encoding: 'utf8' });
const report = { assertions: [], errors: [], physicalDevice: 'unverified', publicNetwork: 'not tested by this fixture' };
const [device] = (await _android.devices()).filter(d => d.serial() === 'emulator-5554');
if (!device) throw new Error('Expected isolated emulator-5554. Never run this against a personal phone.');
try {
  shell('input', 'keyevent', '224'); shell('wm', 'dismiss-keyguard');
  shell('am', 'start', '-n', 'local.focusspace.mobile/.MainActivity');
  const webview = await device.webView({ pkg: 'local.focusspace.mobile' });
  const page = await webview.page(); page.on('pageerror', e => report.errors.push(e.message));
  await expect(page.locator('h1')).toContainText('good sounds');
  expect(await page.evaluate(() => window.Capacitor.getPlatform())).toBe('android');
  const state = () => page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'state', {}));
  expect((await state()).playing).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `${output}/home.png` });
  writeFileSync(`${output}/phone.png`, await device.screenshot());
  await page.getByRole('button', { name: 'Glow', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Glow', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Repeated original MP3 frames form a longer test tone; no third-party recording.
  const buffer = Buffer.concat(Array(20).fill(readFileSync('tests/fixtures/original-tone.mp3')));
  if (await page.getByRole('button', { name: 'Play audio Android original test', exact: true }).count() === 0)
    await page.getByLabel('Import audio files').setInputFiles({ name: 'Android original test.mp3', mimeType: 'audio/mpeg', buffer });
  await page.getByRole('button', { name: 'Play audio Android original test', exact: true }).click();
  await expect.poll(async () => (await state()).time, { timeout: 15000 }).toBeGreaterThan(.2);
  expect((await state()).local).toBe(true);
  expect(await page.locator('audio').getAttribute('src')).toBeNull();
  await page.getByRole('slider', { name: 'Audio position' }).fill('5');
  await expect.poll(async () => (await state()).time).toBeGreaterThan(4.5);
  await page.getByRole('button', { name: 'Pause local audio', exact: true }).click();
  await expect.poll(async () => (await state()).playing).toBe(false);
  await page.getByRole('button', { name: 'Play local audio', exact: true }).click();
  await expect.poll(async () => (await state()).playing).toBe(true);
  report.assertions.push('Actual Android APK renders without overflow/autoplay; mood selection and imported MP3 native playback, seek and pause/resume work without HTML duplicate audio.');
  const before = (await state()).time;
  shell('input', 'keyevent', '3'); shell('input', 'keyevent', '223');
  await new Promise(r => setTimeout(r, 12000));
  const session = shell('dumpsys', 'media_session'); writeFileSync(`${output}/locked-session.txt`, session);
  expect(session).toContain('local.focusspace.mobile');
  expect(session).toMatch(/state=PLAYING\(3\)/);
  shell('cmd', 'media_session', 'dispatch', 'pause');
  await expect.poll(() => shell('dumpsys', 'media_session')).toMatch(/state=PAUSED\(2\)/);
  shell('cmd', 'media_session', 'dispatch', 'play');
  await expect.poll(() => shell('dumpsys', 'media_session')).toMatch(/state=PLAYING\(3\)/);
  shell('input', 'keyevent', '224'); shell('wm', 'dismiss-keyguard'); shell('am', 'start', '-n', 'local.focusspace.mobile/.MainActivity');
  await expect.poll(async () => (await state()).time).toBeGreaterThan(before + 10);
  await expect(page.locator('.audio-current')).toContainText('Android original test');
  await page.getByRole('button', { name: 'Pause local audio', exact: true }).click();
  let rejected = false;
  try { await page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'play', { tracks: [{ id: 'bad', title: 'Bad', artist: 'Fixture', url: 'https://evil.test/song.mp3' }], index: 0, volume: .2 })); }
  catch { rejected = true; }
  expect(rejected).toBe(true);
  report.assertions.push('Native MP3 advances for 12 seconds with Home and screen off; Android media-session pause/play commands work; foreground state restores. Untrusted stream URLs are rejected.');
  await page.locator('.audio-library').scrollIntoViewIfNeeded();
  shell('input', 'swipe', '500', '1600', '500', '1450', '300'); // Real native gesture also refreshes emulator compositor capture.
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/player.png` });
  writeFileSync(`${output}/phone-player.png`, await device.screenshot());
  await page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'stop', {}));
  expect(report.errors).toEqual([]);
  console.log(report);
} finally {
  shell('input', 'keyevent', '224'); shell('am', 'force-stop', 'local.focusspace.mobile');
  await device.close(); writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
}
