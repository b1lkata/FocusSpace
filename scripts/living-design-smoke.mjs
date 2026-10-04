import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const artifacts = resolve('.runtime/living-design');
mkdirSync(artifacts, { recursive: true });
const server = await preview({ mode: 'web-preview', preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
const report = { assertions: [], errors: [], nonLocalRequests: [], browser: 'Isolated Microsoft Edge', physicalTouch: 'unverified; Chromium touch input fixture used' };
let browser;
const pass = value => { report.assertions.push(value); console.log(`PASS ${value}`); };
const image = page => page.locator('.focus-field-canvas').evaluate(canvas => canvas.toDataURL());
const saved = page => page.evaluate(() => localStorage.getItem('focusspace.browser-preview.v1'));

try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  context.on('request', request => { const target = new URL(request.url()); if (['http:', 'https:'].includes(target.protocol) && target.hostname !== '127.0.0.1') report.nonLocalRequests.push(request.url()); });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  // Count actual decorative paints, independent of scene state/implementation fields.
  await page.addInitScript(() => {
    window.fieldPaints = 0;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains('focus-field-canvas')) window.fieldPaints++;
      return clear.apply(this, args);
    };
  });
  await page.goto(`${url}/?legacy=1`);
  await expect(page.getByRole('heading', { name: 'A little room for big ideas.' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator('.hero-kicker').evaluate(element => getComputedStyle(element).fontFamily.includes('Manrope'))).toBe(true);
  expect(await page.evaluate(() => Array.from(document.fonts).some(face => face.family === 'Manrope' && face.status === 'loaded'))).toBe(true);
  pass('bundled interface font loads locally and is used for small text');
  await expect.poll(() => page.evaluate(() => window.fieldPaints)).toBeGreaterThan(1);
  await page.screenshot({ path: join(artifacts, 'home-desktop.png') });
  const initial = await saved(page);
  await page.getByRole('button', { name: 'Pause background animation' }).click();
  await page.mouse.move(1, 1);
  await expect(page.getByRole('button', { name: 'Pause background animation' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(80);
  const paused = await image(page);
  await page.waitForTimeout(180);
  expect((await image(page)) === paused).toBe(true);
  pass('pause stops autonomous drawing without hiding the background');

  await page.mouse.move(1040, 418); await page.mouse.down();
  await page.mouse.move(1150, 455, { steps: 12 }); await page.mouse.up(); await page.mouse.move(1, 1);
  await page.waitForTimeout(80);
  expect((await image(page)) !== paused).toBe(true);
  await page.getByRole('button', { name: 'Reset background' }).click(); await page.mouse.move(1, 1); await page.waitForTimeout(80);
  const reset = await image(page);
  await page.getByRole('button', { name: 'Rotate background' }).focus(); await page.keyboard.press('Enter'); await page.mouse.move(1, 1); await page.waitForTimeout(80);
  expect((await image(page)) !== reset).toBe(true);
  pass('empty-space dragging rotates the scene; keyboard controls rotate and reset it');

  await page.getByRole('button', { name: 'Reset background' }).click(); await page.mouse.move(1, 1); await page.waitForTimeout(80);
  const beforeDrag = await image(page);
  await page.mouse.move(818, 330); await page.mouse.down(); await page.mouse.move(900, 350, { steps: 15 }); await page.mouse.up(); await page.mouse.move(1, 1); await page.waitForTimeout(80);
  expect((await image(page)) !== beforeDrag).toBe(true);
  expect((await saved(page)) === initial).toBe(true);
  await page.screenshot({ path: join(artifacts, 'background-play.png') });
  pass('floating figure gestures change the visual scene without changing saved projects');

  const beforeScroll = await image(page);
  await page.getByRole('region', { name: 'Home', exact: true }).evaluate(element => { element.scrollTop = 240; });
  await page.waitForTimeout(80);
  expect((await image(page)) !== beforeScroll).toBe(true);
  await page.getByRole('region', { name: 'Home', exact: true }).evaluate(element => { element.scrollTop = 0; });
  pass('scrolling shifts the constellation perspective without changing project layout');

  await page.getByRole('button', { name: 'Pause background animation' }).click(); await page.mouse.move(1, 1); await page.waitForTimeout(80);
  const frames = await page.evaluate(() => window.fieldPaints); await page.waitForTimeout(1000);
  const frequency = await page.evaluate(() => window.fieldPaints) - frames;
  report.paintsPerSecond = frequency; expect(frequency > 0 && frequency <= 33).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hiddenFrames = await page.evaluate(() => window.fieldPaints); await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.fieldPaints) === hiddenFrames).toBe(true);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => window.fieldPaints)).toBeGreaterThan(hiddenFrames);
  pass('drawing stays below 33 paints per second and pauses while the document is hidden');

  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.mouse.move(1, 1); await page.waitForTimeout(80);
  await expect(page.getByRole('button', { name: 'Pause background animation' })).toBeDisabled();
  const reduced = await image(page); await page.waitForTimeout(180); expect((await image(page)) === reduced).toBe(true);
  await page.getByRole('button', { name: 'Enter your space' }).click();
  await expect(page.getByRole('heading', { name: 'Build My App', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '▦ Grid', exact: true }).click();
  await page.getByRole('button', { name: '＋ Note', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('Background interaction review'); await page.getByRole('button', { name: 'Add to my space' }).click();
  await page.getByRole('textbox', { name: 'Card content' }).fill('Writing still works normally.');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little room for big ideas.' })).toBeVisible();
  pass('reduced motion is still interactive and normal workspace entry/editing remains usable');

  await page.setViewportSize({ width: 720, height: 460 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Enter your space' })).toBeInViewport();
  await page.screenshot({ path: join(artifacts, 'home-zoom-equivalent.png') });
  pass('home fits the CSS viewport equivalent of 200-percent desktop zoom');
  await page.setViewportSize({ width: 1440, height: 920 });

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const phone = await mobile.newPage(); phone.on('pageerror', error => report.errors.push(error.message));
  await phone.goto(`${url}/?legacy=1`); await expect(phone.getByRole('heading', { name: 'A little room for big ideas.' })).toBeVisible();
  await phone.getByRole('button', { name: 'Pause background animation' }).tap(); await phone.waitForTimeout(80);
  const touchBefore = await image(phone);
  const cdp = await mobile.newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 555 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 + i * 9, y: 555 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await phone.waitForTimeout(80);
  expect((await image(phone)) !== touchBefore).toBe(true);
  await phone.screenshot({ path: join(artifacts, 'home-mobile.png') });
  const scroll = () => phone.getByRole('region', { name: 'Home', exact: true }).evaluate(element => element.scrollTop);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 40, y: 620 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 40, y: 620 - i * 35 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(scroll).toBeGreaterThan(40);
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await phone.getByRole('button', { name: 'Open Build My App' }).tap(); await expect(phone.getByRole('heading', { name: 'Build My App', exact: true })).toBeVisible();
  pass('touch gestures move the scene while vertical swipes scroll and workspace taps still work');

  const noCanvas = await browser.newContext();
  await noCanvas.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === '2d' ? null : get.call(this, type, ...args); };
  });
  const fallback = await noCanvas.newPage(); fallback.on('pageerror', error => report.errors.push(error.message));
  await fallback.goto(`${url}/?legacy=1`); await fallback.getByRole('button', { name: 'Enter your space' }).click();
  await expect(fallback.getByRole('heading', { name: 'Build My App', exact: true })).toBeVisible();
  await noCanvas.close();
  pass('unavailable decorative canvas leaves workspace navigation usable');

  const noFont = await browser.newContext();
  await noFont.route('**/*.ttf', route => route.abort());
  const fontFallback = await noFont.newPage(); fontFallback.on('pageerror', error => report.errors.push(error.message));
  await fontFallback.goto(`${url}/?legacy=1`);
  await expect(fontFallback.getByRole('heading', { name: 'A little room for big ideas.' })).toBeVisible();
  await fontFallback.getByRole('button', { name: 'Enter your space' }).click();
  await expect(fontFallback.getByRole('heading', { name: 'Build My App', exact: true })).toBeVisible();
  await noFont.close();
  pass('font loading failure preserves readable fallback and workspace entry');
  expect(report.errors).toEqual([]); expect(report.nonLocalRequests).toEqual([]); report.completed = true;
} catch (error) { report.completed = false; report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally { if (browser) await browser.close(); await server.close(); writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2)); }
