import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});mkdirSync('.runtime/playlists',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('https://api.openverse.org/**',r=>r.fulfill({json:{results:[]}}));await page.route('https://archive.org/**',r=>r.fulfill({json:{response:{docs:[]}}}));await page.route('**/api/ccmixter?**',r=>r.fulfill({json:[]}));
 await page.route('https://api.audius.co/**',r=>r.request().url().includes('/stream?')?r.fulfill({contentType:'audio/mpeg',body:readFileSync('tests/fixtures/original-long-tone.mp3')}):r.fulfill({json:{data:[{id:'moon',title:'Moonlight',user:{name:'Fixture artist'}}]}}));
 await page.goto('http://127.0.0.1:4173/');await expect(page.locator('#catalog-search-form')).toHaveCount(1);await expect(page.getByText('Find a new frequency.')).toHaveCount(0);
 await page.getByRole('button',{name:'New playlist',exact:true}).click();await page.getByLabel('New playlist name').fill('My favorites');await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByLabel('Playlist color').selectOption('mint');
 const input=page.getByRole('combobox',{name:'Search free music'});await input.fill('Moonlight');await input.press('Enter');await page.getByRole('button',{name:'Add Moonlight to playlist',exact:true}).click();await page.getByRole('dialog',{name:'Add to playlist'}).getByRole('button',{name:'My favorites',exact:true}).click();await expect(page.locator('.playlist-song')).toHaveCount(1);
 await page.getByRole('button',{name:'Play playlist',exact:true}).click();await expect.poll(()=>page.locator('audio').evaluateAll(items=>items.some(audio=>!audio.paused))).toBe(true);
 await page.getByLabel('Playlist name',{exact:true}).fill('After dark');await page.reload();await page.locator('.playlist-card').click();await expect(page.getByLabel('Playlist name',{exact:true})).toHaveValue('After dark');await expect(page.getByLabel('Playlist color')).toHaveValue('mint');await expect(page.locator('.playlist-song')).toHaveCount(1);
 await page.locator('.playlist-library').scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/playlists/phone.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Remove Moonlight',exact:true}).click();await expect(page.locator('.playlist-song')).toHaveCount(0);
 await page.evaluate(()=>localStorage.setItem('focusspace.playlists.v1','{broken'));await page.reload();await expect(page.getByRole('alert').filter({hasText:'Saved playlists'})).toBeVisible();await expect(page.getByRole('button',{name:'New playlist',exact:true})).toBeDisabled();expect(await page.evaluate(()=>localStorage.getItem('focusspace.playlists.v1'))).toBe('{broken');console.log('Playlist create/customize/add/play/reload/remove/corruption/mobile checks passed');
}finally{await browser.close();}
