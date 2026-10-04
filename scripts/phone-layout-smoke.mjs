import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const output = '.runtime/phone-layout'; mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('https://**/*', route => route.fulfill({ json: { data: [], response: { docs: [] }, results: [] } }));
  await context.route('**/api/ccmixter?**', route => route.fulfill({ json: [] }));
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');
  const nav = page.getByRole('navigation', { name: 'Phone navigation' }); await expect(nav).toBeVisible();
  await page.screenshot({ path: `${output}/home.png` });
  await nav.getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.getByRole('combobox', { name: 'Search free music' })).toBeFocused();
  await page.getByRole('combobox', { name: 'Search free music' }).press('Escape');
  await nav.getByRole('button', { name: 'Library', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Your library.', exact: true })).toBeInViewport();
  const navBox = await nav.boundingBox(); expect(navBox.y + navBox.height).toBeLessThanOrEqual(844);
  await page.getByLabel('Import audio files').setInputFiles({ name: 'Phone original.mp3', mimeType: 'audio/mpeg', buffer: readFileSync('tests/fixtures/original-tone.mp3') });
  await page.getByRole('button', { name: 'Play audio Phone original', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.mini-song')).toContainText('Phone original');
  await page.getByRole('button', { name: 'Pause mini player' }).click(); await expect(page.getByRole('button', { name: 'Play mini player' })).toBeVisible();
  await page.getByRole('button', { name: 'Open full player' }).click(); const player = page.getByRole('dialog', { name: 'Now playing', exact: true }); await expect(player).toBeVisible();
  await expect(player.getByRole('button', { name: 'Lyrics', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Share song ↗' }).click(); await expect(page.getByRole('dialog', { name: 'Share this song' })).toBeVisible();
  await page.getByRole('button', { name: 'Close song sharing' }).click(); await expect(player).toBeVisible();
  await player.screenshot({ path: `${output}/player.png` });
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(audit.violations.map(x => x.id)).toEqual([]);
  await page.keyboard.press('Escape'); await expect(player).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Open full player' })).toBeFocused();
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  for (const width of [320, 390, 760]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.setViewportSize({ width: 1440, height: 920 }); await expect(nav).toBeHidden(); await expect(page.locator('.phone-mini-player')).toHaveCount(0); await expect(page.locator('.audio-deck')).toBeVisible();
  expect(errors).toEqual([]); console.log('PASS phone navigation/search/library, persistent mini playback, full player/nested sharing/Escape/focus, WCAG, 320/390/760 layout and desktop restoration. Public requests fixture-only.');
} finally { await browser.close(); }
