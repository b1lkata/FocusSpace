import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); let metadata = 0;
 await page.route('https://archive.org/**', async route => { metadata++; await new Promise(resolve => setTimeout(resolve, 2200)); await route.fulfill({ json: { response: { docs: [] } } }); });
 await page.route('https://api.openverse.org/**', route => { metadata++; return route.fulfill({ json: { results: [] } }); });
 await page.route('**/api/ccmixter?**', route => { metadata++; return route.fulfill({ json: [] }); });
 await page.route('**/api/jamendo?**', route => route.fulfill({ json: { configured: false, tracks: [] } }));
 await page.route('https://ccmixter.org/content/**', r => r.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') }));
 await page.route('https://prod-1.storage.jamendo.com/**', r => r.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') }));
 await page.route('https://api.audius.co/**', route => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/stream')) return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') });
  metadata++;
  const artist = url.searchParams.get('query');
  const artists = url.pathname.endsWith('/trending') ? Array.from({ length: 15 }, (_, i) => `Independent ${i}`) : artist ? [artist] : [];
  return route.fulfill({ json: { data: artists.flatMap((name, i) => Array.from({ length: 6 }, (_, j) => ({ id: `artist${i}song${j}${name.replace(/\W/g, '')}`, title: `${name} - Song ${j}`, duration: 180, user: { name } }))) } });
 });
 const start = Date.now(); await page.goto('http://127.0.0.1:4173/');
 const shelf = page.getByRole('region', { name: 'Artist collections' });
 await expect(shelf.locator('.featured-album').first()).toBeAttached({ timeout: 2000 });
 const firstMs = Date.now() - start; expect(firstMs).toBeLessThan(2200);
 await expect(shelf.getByRole('status')).toHaveText('Only artists with 6+ playable uploads.', { timeout: 60000 });
 // Search retains its provider response safety bounds; matching discovery pages are not a UI album limit.
 await expect(shelf.locator('.featured-album')).toHaveCount(30);
 const previousOrder = await shelf.locator('.featured-album strong').allTextContents();
 const previousCalls = metadata, reloadStart = Date.now(); await page.reload();
 await expect(shelf.locator('.featured-album')).toHaveCount(30, { timeout: 1500 });
 const warmMs = Date.now() - reloadStart; expect(await shelf.locator('.featured-album strong').allTextContents()).not.toEqual(previousOrder);
 await page.waitForTimeout(300); expect(metadata).toBe(previousCalls);
 console.log(JSON.stringify({ firstMs, warmMs, collections: 30, cachedReloadMetadataCalls: metadata - previousCalls, playbackValidation: 'original 65-second MP3', publicNetwork: 'fixture only' }));
} finally { await browser.close(); }
