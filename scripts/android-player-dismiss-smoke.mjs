import { _android, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const adb = resolve('.runtime/android-tools/sdk/platform-tools/adb.exe');
const shell = (...args) => execFileSync(adb, ['-s', 'emulator-5554', 'shell', ...args], { encoding: 'utf8' });
const [device] = (await _android.devices()).filter(item => item.serial() === 'emulator-5554');
if (!device) throw new Error('Expected isolated emulator-5554.');
try {
  shell('input', 'keyevent', '224'); shell('wm', 'dismiss-keyguard'); shell('am', 'start', '-n', 'local.focusspace.mobile/.MainActivity');
  const page = await (await device.webView({ pkg: 'local.focusspace.mobile' })).page();
  if (!await page.getByRole('button', { name: 'Play audio Swipe native', exact: true }).count()) await page.getByLabel('Import audio files').setInputFiles({ name: 'Swipe native.mp3', mimeType: 'audio/mpeg', buffer: Buffer.concat(Array(20).fill(readFileSync('tests/fixtures/original-tone.mp3'))) });
  await page.getByRole('button', { name: 'Play audio Swipe native', exact: true }).click();
  const state = () => page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'state', {}));
  await expect.poll(async () => (await state()).time).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Open full player' }).click();
  const player = page.getByRole('dialog', { name: 'Now playing', exact: true }); await expect(player).toBeVisible();
  const width = Number(shell('wm', 'size').match(/(\d+)x\d+/)[1]), cssWidth = await page.evaluate(() => innerWidth), scale = width / cssWidth;
  const box = await player.locator('.audio-record').boundingBox();
  const x = Math.round((box.x + box.width / 2) * scale), y = Math.round((box.y + 40) * scale + 24 * scale);
  const before = (await state()).time;
  shell('input', 'swipe', String(x), String(y), String(x), String(y + Math.round(160 * scale)), '350');
  await expect(player).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause mini player' })).toBeVisible();
  expect((await state()).playing).toBe(true); await expect.poll(async () => (await state()).time).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Open full player' }).click(); await expect(player).toBeVisible();
  console.log('PASS actual Android native touch swipe minimizes player, mini playback keeps advancing and player reopens. Physical phone unverified.');
} finally { shell('am', 'force-stop', 'local.focusspace.mobile'); await device.close(); }
