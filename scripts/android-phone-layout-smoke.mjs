import { _android, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const output = '.runtime/phone-layout/android'; mkdirSync(output, { recursive: true });
const adb = resolve('.runtime/android-tools/sdk/platform-tools/adb.exe');
const shell = (...args) => execFileSync(adb, ['-s', 'emulator-5554', 'shell', ...args], { encoding: 'utf8' });
const [device] = (await _android.devices()).filter(item => item.serial() === 'emulator-5554');
if (!device) throw new Error('Expected isolated emulator-5554, never a personal phone.');
try {
  shell('input', 'keyevent', '224'); shell('wm', 'dismiss-keyguard'); shell('am', 'start', '-n', 'local.focusspace.mobile/.MainActivity');
  const view = await device.webView({ pkg: 'local.focusspace.mobile' }), page = await view.page();
  const nav = page.getByRole('navigation', { name: 'Phone navigation' }); await expect(nav).toBeVisible();
  await page.screenshot({ path: `${output}/home-webview.png` }); writeFileSync(`${output}/home.png`, await device.screenshot());
  await nav.getByRole('button', { name: 'Library', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Your rotation.', exact: true })).toBeInViewport();
  if (!await page.getByRole('button', { name: 'Play audio Phone native', exact: true }).count()) await page.getByLabel('Import audio files').setInputFiles({ name: 'Phone native.mp3', mimeType: 'audio/mpeg', buffer: readFileSync('tests/fixtures/original-tone.mp3') });
  await page.getByRole('button', { name: 'Play audio Phone native', exact: true }).click();
  const state = () => page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'state', {}));
  await expect.poll(async () => (await state()).time).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause mini player' }).click(); await expect.poll(async () => (await state()).playing).toBe(false);
  await page.getByRole('button', { name: 'Open full player' }).click(); const player = page.getByRole('dialog', { name: 'Now playing', exact: true }); await expect(player).toBeVisible();
  await player.getByRole('slider', { name: 'Audio position' }).fill('1'); await expect.poll(async () => (await state()).time).toBeGreaterThan(.9);
  await page.screenshot({ path: `${output}/player-webview.png` }); await page.waitForTimeout(500); writeFileSync(`${output}/player.png`, await device.screenshot());
  await player.getByRole('button', { name: 'Close full player' }).click(); await expect(player).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const pet = await page.locator('.viewport-companion').boundingBox(), mini = await page.locator('.phone-mini-player').boundingBox(); expect(pet.y + pet.height).toBeLessThan(mini.y);
  console.log('PASS actual Android bottom navigation/library, persistent mini native MP3 pause, full-player native seek/close, no overflow and pet above controls. No public stream/physical phone/iOS claim.');
} finally { shell('am', 'force-stop', 'local.focusspace.mobile'); await device.close(); }
