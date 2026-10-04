import fs from 'node:fs';import {chromium,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
fs.mkdirSync('.runtime/demo-check',{recursive:true});
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[],outside=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))outside.push(request.url());});
 const url=process.env.TUNIKO_DEMO_URL??'http://127.0.0.1:4174/';await page.goto(url);
 await expect(page.getByRole('heading',{name:'For you',exact:true})).toBeVisible();await expect(page.locator('.featured-album')).toHaveCount(3);
 await expect(page.getByText('Original instrumental sketches.',{exact:true})).toBeVisible();await expect(page.locator('.home-song-play')).toHaveCount(6);
 await page.waitForFunction(()=>[...document.querySelectorAll('.home-song-play img')].slice(0,2).every(image=>image.complete&&image.naturalWidth>0&&getComputedStyle(image).opacity==='1'));
 await page.screenshot({path:'.runtime/demo-check/home-phone.png'});
 const durations=await page.evaluate(async()=>{const values=[];for(let index=0;index<18;index++){const audio=new Audio();audio.preload='metadata';audio.src=`./demo/audio/demo${String(index).padStart(2,'0')}.mp3`;const duration=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Audio metadata timeout')),5000);audio.onloadedmetadata=()=>{clearTimeout(timer);resolve(audio.duration);};audio.onerror=()=>{clearTimeout(timer);reject(new Error('Sample audio unavailable'));};});values.push(duration);audio.removeAttribute('src');audio.load();}return values;});expect(durations.every(duration=>duration>=60&&duration<70)).toBe(true);
 await page.locator('.home-song-play').first().click();await expect.poll(()=>page.locator('audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(0);await page.locator('.mini-play').click();
 const search=page.getByRole('combobox',{name:'Search free music'});await search.fill('Cluod atlas');await page.locator('#catalog-search-form').evaluate(form=>form.requestSubmit());await expect(page.locator('.catalog-track')).toHaveCount(1);await expect(page.locator('.catalog-track')).toContainText('Cloud atlas');await page.keyboard.press('Escape');
 for(const mood of ['Chill','Happy','Focus','Energy','Romance','Night']){await page.getByRole('button',{name:`Explore ${mood} music`,exact:true}).click();const panel=page.getByRole('dialog',{name:`${mood} mix`,exact:true});await expect(panel.locator('.mood-mix-song').first()).toBeVisible();await expect(search).toHaveValue('Cluod atlas');const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(item=>item.id)).toEqual([]);await page.keyboard.press('Escape');}
 await page.getByRole('button',{name:'Open full player',exact:true}).click();await page.getByRole('dialog',{name:'Now playing',exact:true}).getByRole('button',{name:/^Like /}).click();await page.getByRole('button',{name:'Close full player',exact:true}).click();await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tuniko.liked-songs.v1')).tracks.length)).toBe(1);
 for(const width of [320,390,760,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.goto(url+'?legacy=1');await expect(page.getByRole('heading',{name:'For you',exact:true})).toBeVisible();await expect(page.getByText('Previous spaces',{exact:true})).toHaveCount(0);
 expect(outside).toEqual([]);expect(errors).toEqual([]);
 fs.writeFileSync('.runtime/demo-check/result.json',JSON.stringify({passed:true,samples:durations.length,externalRequests:outside,errors,widths:[320,390,760,1440]},null,2));
 console.log('PASS original 18 MP3 samples decode, local typo search, six mood windows, likes persist, player, WCAG/layout, no external requests and legacy surface disabled.');
}finally{await browser.close();}
