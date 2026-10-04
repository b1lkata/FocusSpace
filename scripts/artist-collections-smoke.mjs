import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
 await page.route('https://archive.org/**', r => r.fulfill({ json: { response: { docs: [] } } }));
 await page.route('https://api.openverse.org/**', r => r.fulfill({ json: { results: [] } }));
 await page.route('**/api/ccmixter?**', r => r.fulfill({ json: [] }));
 await page.route('**/api/jamendo?**', r => r.fulfill({ json: { configured: false, tracks: [] } }));
 await page.route('https://ccmixter.org/content/**', r => r.fulfill({ status: 403 }));
 await page.route('https://prod-1.storage.jamendo.com/**', r => r.fulfill({ status: 403 }));
 await page.route('https://api.audius.co/**', r => {
  const url = new URL(r.request().url());
  if (url.pathname.endsWith('/stream') && !/\/(a|w|i)\d\/stream$/.test(url.pathname)) return r.fulfill({ status: 403 });
  if (url.pathname.endsWith('/stream')) return r.fulfill({ contentType: 'audio/mpeg', body: readFileSync('tests/fixtures/original-long-tone.mp3') });
  const artist = url.pathname.endsWith('/trending') ? 'Ariana Grande' : url.searchParams.get('query');
  const size = artist === 'Adele' ? 7 : artist === 'The Weeknd' ? 4 : artist === 'Ariana Grande' ? 6 : 0;
  return r.fulfill({ json: { data: Array.from({ length: size }, (_, i) => ({ id: `${artist === 'Adele' ? 'a' : artist === 'The Weeknd' ? 'w' : 'i'}${i}`, title: `${artist} - Song ${i} [Official Audio]`, user: { name: 'Fixture uploader' }, duration: 180 })) } });
 });
 await page.goto('http://127.0.0.1:4173/');
 const shelf = page.getByRole('region', { name: 'Artist collections' }); await shelf.scrollIntoViewIfNeeded();
 await expect(shelf.getByRole('status')).toHaveText('Only artists with 6+ playable uploads.', { timeout: 60000 });
 await expect(shelf.locator('.featured-album')).toHaveCount(2);
 expect(await shelf.locator('.featured-album').allTextContents()).toEqual(expect.arrayContaining(['Adele7 songs', 'Ariana Grande6 songs']));
 expect(await page.evaluate(() => document.querySelector('.featured-albums').compareDocumentPosition(document.querySelector('.audio-library')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
 await shelf.locator('.featured-album').filter({ hasText: 'Adele' }).click();
 await expect(shelf.locator('li')).toHaveCount(7);
 await expect(shelf.locator('li strong').first()).toHaveText('Song 0');
 await shelf.locator('li button').first().click();
 await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
 console.log('PASS: sparse artist excluded, replacement artist loaded, six-song minimum, simplified titles, above rotation, direct fixture MP3 playback and phone bounds.');
} finally { await browser.close(); }
