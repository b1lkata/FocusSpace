import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const seed=JSON.parse(fs.readFileSync('src/renderer/music/preloadedCollections.json','utf8'));
const b=await chromium.launch({channel:'msedge',headless:true});
try {
 const p=await b.newPage({viewport:{width:390,height:844}});
 await p.addInitScript(seed=>localStorage.setItem('tuniko.artist-title-collections.v3',JSON.stringify({...seed,savedAt:Date.now()})),seed);
 await p.route(/^https:\/\//,r=>r.fulfill({status:503,body:'Network intentionally unavailable'}));
 await p.goto('http://127.0.0.1:4173/');
 const images=p.locator('.home-song-play img');await expect(images).toHaveCount(8);
 for(const image of await images.all()) {await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);expect(await image.getAttribute('src')).toMatch(/^\.\/artwork\//);}
 const covers=p.locator('.featured-album img');await expect(covers).toHaveCount(26);
 for(const image of await covers.all()) {await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);expect(await image.getAttribute('src')).toMatch(/^\.\/artwork\//);}
 await p.locator('.home-song-play').first().scrollIntoViewIfNeeded();
 await p.screenshot({path:'.runtime/artwork-fix/home-phone.png'});
 // Force a real load error and verify the shared image component advances to
 // its local fallback, rather than leaving a broken/blank image.
 await p.route('**/artwork/*.jpg',r=>r.abort());
 await p.reload();const first=p.locator('.home-song-play img').first();
 await expect(first).toHaveAttribute('src','./artwork/fallback.svg');
 await expect.poll(()=>first.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 console.log('PASS all 8 For you cards and 26 artist covers load with public network blocked; broken-art local fallback renders.');
} finally {await b.close();}

