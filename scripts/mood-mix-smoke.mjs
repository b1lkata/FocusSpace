import fs from 'node:fs';import {chromium,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
const seed=JSON.parse(fs.readFileSync('src/renderer/music/preloadedCollections.json'));
const b=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await b.newContext({viewport:{width:390,height:844}});const p=await context.newPage();
 await p.addInitScript(seed=>localStorage.setItem('tuniko.artist-title-collections.v3',JSON.stringify({...seed,savedAt:Date.now()})),seed);
 const urls=[];
 await p.route('https://api.audius.co/**',r=>{urls.push(r.request().url());if(r.request().url().includes('/stream?'))return r.fulfill({contentType:'audio/mpeg',body:fs.readFileSync('tests/fixtures/original-long-tone.mp3')});return r.fulfill({json:{data:[{id:'ambientfixture',title:'Cloud atlas',user:{name:'Sound studio'},genre:'Ambient',tags:'instrumental',duration:65,artwork:{'480x480':'https://invalid.example/image.jpg'}}]}});});
 await p.route(/^https:\/\/(?!api\.audius\.co)/,r=>r.fulfill({status:503,body:'fixture'}));
 await p.locator('body');await p.goto('http://127.0.0.1:4173/');
 const search=p.getByRole('combobox',{name:'Search free music'});await search.fill('Keep this text');await search.press('Escape');
 for(const mood of ['Chill','Happy','Focus','Energy','Romance','Night']) {
  await p.getByRole('button',{name:`Explore ${mood} music`,exact:true}).click();const window=p.getByRole('dialog',{name:`${mood} mix`,exact:true});await expect(window).toBeVisible();await expect(search).toHaveValue('Keep this text');
  await expect.poll(()=>window.locator('.mood-mix-song').count()).toBeGreaterThan(0);
  const audit=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(v=>v.id)).toEqual([]);
  for(const width of [320,390,760,1440]){await p.setViewportSize({width,height:844});expect(await window.evaluate(e=>e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=innerWidth)).toBe(true);expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await p.setViewportSize({width:390,height:844});if(mood==='Focus'){await expect(window).toContainText('Cloud atlas');await p.screenshot({path:'.runtime/mood-mix-phone.png'});await window.getByRole('button',{name:'New mix'}).click();await expect(window.getByRole('button',{name:'New mix'})).toBeEnabled();await expect(window.locator('.mood-mix-song')).toHaveCount(1);await expect(search).toHaveValue('Keep this text');}
  await p.keyboard.press('Escape');await expect(window).not.toBeVisible();await expect(p.getByRole('button',{name:`Explore ${mood} music`,exact:true})).toBeFocused();
 }
 expect(urls.some(url=>url.includes('/trending?')&&url.includes('genre=Ambient'))).toBe(true);
 expect(urls.some(url=>url.includes('/search?')&&/[?&]query=(chill|happy|lofi|dance|love|ambient)(&|$)/.test(url))).toBe(false);
 await p.getByRole('button',{name:'Explore Focus music',exact:true}).click();const window=p.getByRole('dialog',{name:'Focus mix',exact:true});await expect(window.locator('.mood-mix-song')).not.toHaveCount(0);await window.locator('.mood-mix-song').first().click();await expect(window).not.toBeVisible();await expect.poll(()=>p.locator('audio').evaluate(a=>a.currentTime)).toBeGreaterThan(0);await expect(p.locator('.phone-mini-player')).toContainText('Cloud atlas');
 console.log('PASS six independent mood windows, genre browsing without title keywords, direct original-fixture playback, unchanged search, Escape/focus, WCAG and 320/390/760/1440 bounds.');
}finally{await b.close();}
