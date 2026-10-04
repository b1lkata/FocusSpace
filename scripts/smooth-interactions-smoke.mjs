import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.route('https://**/*',r=>r.fulfill({json:{data:[],response:{docs:[]},results:[]}}));
 await page.route('**/api/ccmixter?**',r=>r.fulfill({json:[]}));
 await page.goto('http://127.0.0.1:4173');
 const search=page.getByRole('navigation',{name:'Phone navigation'}).getByRole('button',{name:'Search',exact:true});
 expect(await search.evaluate(e=>getComputedStyle(e).webkitTapHighlightColor)).toBe('rgba(0, 0, 0, 0)');
 await search.tap(); await expect(page.getByRole('combobox',{name:'Search free music'})).toBeFocused();
 await page.getByRole('combobox',{name:'Search free music'}).press('Escape');
 const home=page.getByRole('navigation',{name:'Phone navigation'}).getByRole('button',{name:'Home',exact:true});
 await home.tap(); expect(await home.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');
 await page.keyboard.press('Tab');
 expect(await page.locator(':focus-visible').count()).toBeGreaterThan(0);
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await home.evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 console.log('PASS touch: transparent tap highlight, first-tap navigation, no pointer outline; keyboard focus retained, reduced motion and phone bounds. Local fixtures only.');
}finally{await browser.close();}
