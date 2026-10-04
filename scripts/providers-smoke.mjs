import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = '.runtime/providers'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { assertions: [], publicNetwork: {}, errors: [] };
try {
 const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); page.on('pageerror', e => report.errors.push(e.message));
 await page.route('https://api.audius.co/**', route => route.request().url().includes('/stream?') ? route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') }) : route.fulfill({ json: { data: [{ id: 'a1', title: 'Night drive remix', user: { name: 'Audius artist' } }] } }));
 await page.route('https://archive.org/**', route => {
  const url = route.request().url();
  if (url.includes('/download/')) return route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') });
  if (url.includes('/services/img/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#cfa"/></svg>' });
  return route.fulfill({ json: url.includes('/metadata/') ? { metadata: { title: 'Album', creator: 'Archive artist', licenseurl: 'https://creativecommons.org/licenses/by/4.0/' }, files: [{ name: 'Night drive.mp3', title: 'Night drive', length: '183' }] } : { response: { docs: [{ identifier: 'fixture' }] } } });
 });
 await page.route('**/api/ccmixter?**', route => route.fulfill({ json: [{ upload_id: 123, upload_name: 'Night drive live', user_name: 'Mixter artist', license_url: 'https://creativecommons.org/licenses/by/3.0/', file_page_url: 'https://ccmixter.org/files/artist/123', files: [{ file_name: 'song.mp3', download_url: 'https://ccmixter.org/content/artist/song.mp3' }] }] }));
 await page.route('https://ccmixter.org/content/**', route => route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') }));
 await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [{ id: '12345678-1234-4234-8234-123456789012', title: 'Night drive acoustic', creator: 'Jamendo artist', url: 'https://prod-1.storage.jamendo.com/?trackid=42&format=mp32', foreign_landing_url: 'https://www.jamendo.com/track/42', license_url: 'https://creativecommons.org/licenses/by/4.0/', source: 'jamendo', category: 'music', duration: 180000 }] } }));
 await page.route('https://prod-1.storage.jamendo.com/**', route => route.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') }));
 await page.goto('http://127.0.0.1:4173/'); await page.getByRole('combobox', { name: 'Search free music' }).fill('Night drive'); await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click();
 await expect(page.locator('.catalog-track')).toHaveCount(4); await expect(page.locator('.catalog-track').first()).toContainText('Archive artist');
 await expect(page.locator('.track-provider')).toHaveText(['Internet Archive', 'Audius', 'ccMixter', 'Jamendo (Openverse)']);
 const row = page.locator('.catalog-track').first(); await row.scrollIntoViewIfNeeded(); await expect(row.getByRole('link', { name: 'License' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
 await row.getByText('Night drive', { exact: true }).click(); await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0); await expect(page.locator('iframe')).toHaveCount(0);
 await page.getByRole('combobox', { name: 'Search free music' }).focus();
 await page.locator('.catalog-track').filter({ hasText: 'Jamendo artist' }).locator('.track-artwork').tap(); await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
 await page.locator('.full-catalog').screenshot({ path: `${out}/phone.png` });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
 await page.route('https://api.audius.co/**', route => route.fulfill({ status: 503 })); await page.getByRole('combobox', { name: 'Search free music' }).fill('Night'); await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.locator('.catalog-track')).toHaveCount(3); await expect(page.locator('#song-suggestions').getByRole('status')).toContainText('Audius is unavailable');
 report.assertions.push('Four-source search, exact match ranking, provider/credit/license, Archive MP3 playback without video, mobile layout, and partial-provider failure pass.');
 expect(report.errors).toEqual([]);
 const live = await browser.newPage(); live.on('console', msg => { if (msg.type() === 'error') report.publicNetwork.errors = [...(report.publicNetwork.errors ?? []), msg.text().slice(0,200)]; }); await live.goto('http://127.0.0.1:4173/'); await live.getByRole('combobox', { name: 'Search free music' }).fill('ambient'); await live.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click();
 try { await expect(live.locator('.catalog-track').first()).toBeAttached({ timeout: 70000 }); while (await live.getByRole('button', { name: 'Show more songs' }).count()) await live.getByRole('button', { name: 'Show more songs' }).click(); report.publicNetwork.providers = await live.locator('.track-provider').allTextContents(); report.publicNetwork.status = await live.locator('#song-suggestions').getByRole('status').textContent(); const archive = live.locator('.catalog-track').filter({ hasText: 'Internet Archive' }).first(); if (await archive.count()) { await archive.getByRole('button', { name: /^Stream / }).click(); await expect.poll(() => live.locator('audio').evaluate(audio => audio.currentTime), { timeout: 15000 }).toBeGreaterThan(0); report.publicNetwork.archivePlayback = 'advancing'; } } catch (e) { report.publicNetwork.unverified = e.message.slice(0, 300); }
 const jamendo = live.locator('.catalog-track').filter({ hasText: 'Jamendo (Openverse)' }).first();
 if (await jamendo.count()) { try { await jamendo.getByRole('button', { name: /^Stream / }).click(); await expect.poll(() => live.locator('audio').evaluate(audio => audio.currentTime), { timeout: 15000 }).toBeGreaterThan(0); report.publicNetwork.jamendoPlayback = 'advancing'; } catch { report.publicNetwork.jamendoPlayback = 'unverified'; } }
 console.log(JSON.stringify(report));
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); }
