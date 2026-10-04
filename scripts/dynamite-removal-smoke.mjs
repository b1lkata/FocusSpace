import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';
const old = JSON.parse(fs.readFileSync('.runtime/pre-dynamite-removal-bts.json'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
 await page.addInitScript(collection => localStorage.setItem('tuniko.artist-title-collections.v3', JSON.stringify({version:1,savedAt:Date.now(),collections:[collection]})), old);
 await page.route('https://api.audius.co/**', r => r.request().url().includes('/stream?') ? r.fulfill({contentType:'audio/mpeg',body:fs.readFileSync('tests/fixtures/original-long-tone.mp3')}) : r.fulfill({json:{data:old.tracks}}));
 await page.route('https://archive.org/**', r=>r.fulfill({json:{response:{docs:[]}}}));
 await page.route('https://api.openverse.org/**', r=>r.fulfill({json:{results:[]}}));
 await page.route('**/api/ccmixter?**', r=>r.fulfill({json:[]}));
 await page.route('**/api/jamendo?**', r=>r.fulfill({json:{configured:false,tracks:[]}}));
 await page.goto('http://127.0.0.1:4173/');
 const card=page.locator('.featured-album').filter({hasText:'BTS'});
 await expect(card).toContainText('5 songs'); await card.click();
 await expect(page.locator('.featured-album-detail li')).toHaveCount(5);
 await expect(page.locator('.featured-album-detail')).not.toContainText('1980');
 await expect(card.locator('img')).toHaveAttribute('src',JSON.parse(fs.readFileSync('src/renderer/music/collectionArtwork.json')).BTS.cover);
 const input=page.getByRole('combobox',{name:'Search free music'}); await input.fill('dynamite');
 await expect(page.locator('.catalog-track')).toHaveCount(1);
 await expect(page.locator('.catalog-track')).not.toContainText('1980');
 await input.press('Escape'); await page.reload(); await expect(card).toContainText('5 songs');
 console.log('PASS: old cache filtered, BTS five songs/artwork retained on reload, search excludes only 1980 recording. Deterministic local audio/API fixtures.');
} finally { await browser.close(); }
