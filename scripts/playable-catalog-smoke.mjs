import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});mkdirSync('.runtime/playable-catalog',{recursive:true});
try {
 const page=await browser.newPage();let failGood=false;
 await page.route('https://archive.org/**',r=>r.fulfill({json:{response:{docs:[]}}}));await page.route('https://api.openverse.org/**',r=>r.fulfill({json:{results:[]}}));await page.route('**/api/ccmixter?**',r=>r.fulfill({json:[]}));
 await page.route('https://api.audius.co/**',r=>{
  const url=r.request().url();if(url.includes('/stream?')) { if(url.includes('/broken/')||(url.includes('/good/')&&failGood))return r.fulfill({status:403,body:'Unavailable'});if(url.includes('/invalid/'))return r.fulfill({contentType:'audio/mpeg',body:'not audio'});return r.fulfill({contentType:'audio/mpeg',body:readFileSync('tests/fixtures/original-long-tone.mp3')}); }
  return r.fulfill({json:{data:['good','broken','invalid'].map(id=>({id,title:id,user:{name:'Fixture'}}))}});
 });
 await page.goto('http://127.0.0.1:4173/');const search=page.getByRole('combobox',{name:'Search free music'});await search.focus();await expect(page.locator('.song-suggestion')).toHaveCount(1,{timeout:15000});await search.fill('good');await search.press('Enter');await expect(page.locator('.catalog-track')).toHaveCount(1,{timeout:15000});await expect(page.locator('.catalog-track')).toContainText('good');
 failGood=true;await page.getByRole('button',{name:'Stream good by Fixture',exact:true}).click();await expect(page.locator('.catalog-track')).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('hidden from the catalog');await search.focus();await expect(page.locator('.catalog-track')).toHaveCount(0);await expect(page.locator('.song-suggestion')).toHaveCount(0);
 for(const shape of ['blob','cat','bear','star']) {await page.getByLabel('Companion shape',{exact:true}).selectOption(shape);for(const accessory of ['headphones','cap','bow','glasses','sprout']) {await page.getByLabel('Companion accessory',{exact:true}).selectOption(accessory);await page.locator('.viewport-companion').screenshot({path:`.runtime/playable-catalog/${shape}-${accessory}.png`});}}
 console.log('PASS unavailable/undecodable streams excluded before display; later playback failure removed from results and suggestions; accessory screenshots captured');
}finally{await browser.close();}
