import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';

const output = resolve('.runtime/room-design'); mkdirSync(output, { recursive: true });
const server = await preview({ mode: 'web-preview', preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], assertions = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?legacy=1`);
  await page.getByRole('button', { name: 'Open Build My App' }).click();
  await expect(page.locator('.spatial-desk .scene-label')).toHaveCount(4);
  await expect(page.locator('.scene-label').first()).toBeVisible();
  await page.screenshot({ path: resolve(output, 'desk.png') });
  await page.getByRole('button', { name: 'Pause object motion' }).click();
  await page.waitForTimeout(120);
  const still = await page.locator('.scene-root canvas').screenshot();
  await page.waitForTimeout(240);
  expect(await page.locator('.scene-root canvas').screenshot()).toEqual(still);
  await page.getByRole('button', { name: 'Play object motion' }).click();
  await page.waitForTimeout(240);
  expect(await page.locator('.scene-root canvas').screenshot()).not.toEqual(still);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  await page.waitForTimeout(120);
  const hidden = await page.locator('.scene-root canvas').screenshot();
  await page.waitForTimeout(240);
  expect(await page.locator('.scene-root canvas').screenshot()).toEqual(hidden);
  await page.evaluate(() => { delete document.hidden; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Pause object motion' })).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assertions.push('Object motion changes the canvas, pauses completely, rests in a hidden-document fixture and respects reduced motion.');
  await page.getByRole('button', { name: 'Arrange cards', exact: true }).click();
  const beforeDrag = await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data.workspaces[0].cards[0].position);
  const title = await page.locator('.scene-label').first().boundingBox();
  await page.mouse.move(title.x + title.width / 2, title.y - 55);
  await page.mouse.down();
  await page.mouse.move(title.x + title.width / 2 + 30, title.y - 30, { steps: 12 });
  await page.mouse.up();
  expect(await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data.workspaces[0].cards[0].position)).not.toEqual(beforeDrag);
  await page.getByRole('button', { name: 'Finish arranging', exact: false }).click();
  assertions.push('Dragging the actual screen body changes its saved position.');
  const initial = await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data.workspaces[0].cards);
  const canvas = await page.locator('.scene-root canvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width * .8, canvas.y + canvas.height * .3);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * .7, canvas.y + canvas.height * .4, { steps: 15 });
  await page.mouse.up();
  await page.screenshot({ path: resolve(output, 'orbit.png') });
  expect(await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data.workspaces[0].cards)).toEqual(initial);
  assertions.push('Orbit changes the perspective without changing saved cards.');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await expect(page.locator('.scene-label')).toHaveCount(4);
  await page.waitForTimeout(1000); // Allow the remounted WebGL renderer to compile and paint the fit view.
  await page.screenshot({ path: resolve(output, 'compact-fit.png') });
  const bounds = await page.locator('.workspace-canvas').boundingBox();
  for (const label of await page.locator('.scene-label').all()) {
    const box = await label.boundingBox();
    expect(box.x + box.width / 2).toBeGreaterThan(bounds.x);
    expect(box.x + box.width / 2).toBeLessThan(bounds.x + bounds.width);
    expect(box.y + box.height / 2).toBeGreaterThan(bounds.y);
    expect(box.y + box.height / 2).toBeLessThan(bounds.y + bounds.height);
  }
  assertions.push('Fit all keeps every tile center within a narrow workspace.');
  await page.locator('.scene-label').filter({ hasText: 'A calmer way to work' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Card content' })).toBeVisible();
  assertions.push('Physical tiles retain keyboard access to the note editor.');
  expect(errors).toEqual([]);
  assertions.forEach(value => console.log(`PASS ${value}`));
} finally {
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ assertions, errors }, null, 2));
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
