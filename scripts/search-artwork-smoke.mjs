import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const output = '.runtime/search-artwork'; mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { assertions: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [] } }));
  await page.route('https://archive.org/**', route => route.fulfill({ json: { response: { docs: [] } } }));
  await page.route('**/api/ccmixter?**', route => route.fulfill({ json: [] }));
  await page.route('https://art.fixture/**', route => route.request().url().endsWith('broken.jpg') ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ad97de"/><circle cx="50" cy="50" r="30" fill="#302839"/></svg>' }));
  await page.route('https://api.audius.co/v1/tracks/**', route => {
    if (route.request().url().includes('/stream?')) return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') });
    const term = new URL(route.request().url()).searchParams.get('query');
    const data = term === 'missing' ? [] : [
      { id: 'remix', title: 'Night Drive (Remix)', user: { name: 'DJ Example' }, artwork: { '480x480': 'https://art.fixture/broken.jpg' } },
      { id: 'exact', title: 'Night Drive', user: { name: 'Example Artist' }, duration: 183, artwork: { '480x480': 'https://art.fixture/album.jpg' } },
      ...Array.from({ length: 14 }, (_, i) => ({ id: `other${i}`, title: `Night Drive related song ${i}`, user: { name: 'Another Artist' } }))
    ]; return route.fulfill({ json: { data } });
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('combobox', { name: 'Search free music' }).fill('Night Drive');
  await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.catalog-track')).toHaveCount(12);
  await expect(page.locator('.catalog-track').first()).toContainText('Example Artist');
  await expect(page.locator('.catalog-track').first()).toContainText('3:03');
  await page.locator('.catalog-track').first().scrollIntoViewIfNeeded();
  await expect.poll(() => page.getByRole('img', { name: 'Artwork for Night Drive', exact: true }).evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Show more songs' }).click(); await expect(page.locator('.catalog-track')).toHaveCount(16);
  await page.locator('.catalog-track').filter({ hasText: 'Night Drive (Remix)' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('img', { name: 'No artwork available for Night Drive (Remix)' })).toBeVisible();
  await expect(page.locator('.track-version').first()).toHaveText('Remix');
  await page.locator('.full-catalog').screenshot({ path: `${output}/desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.catalog-track').first().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(page.getByRole('img', { name: 'Artwork for Night Drive', exact: true })).toBeVisible();
  await page.locator('.full-catalog').screenshot({ path: `${output}/phone.png` });
  await expect(page.locator('.mood-card')).toHaveCount(6);
  await page.getByRole('combobox', { name: 'Search free music' }).fill('missing');
  await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.catalog-track')).toHaveCount(0); await expect(page.getByRole('status')).toContainText('free catalogs may not carry');
  await page.getByRole('combobox', { name: 'Search free music' }).focus(); await page.getByRole('button', { name: 'lofi', exact: true }).click(); await expect(page.getByRole('status')).toContainText('lofi');
  report.assertions.push('Exact title ranks first; HTTPS artwork loads; missing/broken art falls back; versions/durations and 12-row expansion work; phone artwork/no overflow and six listening moods verified; missing-song message and one-click hint search work.');
  expect(report.errors).toEqual([]); console.log(report);
} finally { await browser.close(); writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); }
