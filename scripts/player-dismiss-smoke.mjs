import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
mkdirSync('.runtime/player-dismiss', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.route('https://**/*', route => route.fulfill({ json: { data: [], results: [], response: { docs: [] } } }));
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4173');
  await page.getByLabel('Import audio files').setInputFiles({ name: 'Swipe original.mp3', mimeType: 'audio/mpeg', buffer: readFileSync('tests/fixtures/original-tone.mp3') });
  await page.getByRole('button', { name: 'Play audio Swipe original', exact: true }).click();
  await page.locator('audio').evaluate(audio => { audio.loop = true; });
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Open full player' }).click();
  const player = page.getByRole('dialog', { name: 'Now playing', exact: true }), cdp = await context.newCDPSession(page);
  async function swipe(dy, dx = 0, cancel = false) {
    const box = await player.locator('.audio-record').boundingBox(), x = box.x + box.width / 2, y = box.y + 30;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  }
  await swipe(30); await expect(player).toBeVisible();
  await swipe(110, 140); await expect(player).toBeVisible();
  await swipe(140, 0, true); await expect(player).toBeVisible();
  await swipe(160); await expect(player).not.toBeVisible();
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(false);
  await expect(page.getByRole('button', { name: 'Pause mini player' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Phone navigation' })).toBeVisible();
  await page.screenshot({ path: '.runtime/player-dismiss/browsing.png' });
  await page.getByRole('button', { name: 'Open full player' }).click(); await expect(player).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await swipe(150); await expect(player).not.toBeVisible();
  expect(await page.locator('audio').evaluate(audio => audio.paused)).toBe(false);
  console.log('PASS actual touch swipe dismiss/reopen, short/horizontal/cancel rejection, mini player/navigation return and uninterrupted looping original audio, reduced motion.');
} finally { await browser.close(); }
