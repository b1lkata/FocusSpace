import { _electron as electron, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const artifacts = resolve('.runtime/hardening'); mkdirSync(artifacts, { recursive: true });
const dataDirectory = mkdtempSync(join(artifacts, 'data-'));
const server = createServer((request, response) => {
  if (request.url === '/download') { response.setHeader('Content-Disposition', 'attachment; filename="fixture.txt"'); response.end('FocusSpace deterministic download'); return; }
  response.setHeader('Content-Type', 'text/html');
  if (request.url === '/popup') { response.end('<title>Accepted popup</title><main><h1>Accepted popup</h1></main>'); return; }
  response.end('<title>Boundary fixture</title><main><h1>Boundary fixture</h1><button onclick="window.open(\'/popup\',\'_blank\')">Popup</button><button onclick="Notification.requestPermission().then(p=>document.querySelector(\'#permission\').textContent=p)">Request notification</button><span id="permission">Not requested</span><a href="/download">Download fixture</a></main>');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const report = { assertions: [], errors: [], gpuFallback: 'not checked' };
let app;
const pass = text => { report.assertions.push(text); console.log(`PASS ${text}`); };
async function launch(extra = []) {
  const env = { ...process.env, FOCUSSPACE_LEGACY: '1', FOCUSSPACE_DATA_DIR: dataDirectory }; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: [...extra, '.'], env });
  app.process().stderr.on('data', value => { const text = value.toString(); if (/Uncaught Exception|TypeError|Object has been destroyed/.test(text)) report.errors.push(text); });
  const page = await app.firstWindow(); page.on('pageerror', e => report.errors.push(e.message));
  await expect(page.locator('h1')).toBeVisible();
  const persisted = await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data);
  const active = persisted.workspaces.find(w => w.id === persisted.preferences.activeWorkspaceId);
  if (active && !active.archived) await page.getByRole('button', { name: `Open ${active.name}`, exact: true }).click(); return page;
}
try {
  let page = await launch();
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('Boundary tests');
  await page.getByRole('button', { name: 'Add to my space', exact: true }).click();
  await page.getByRole('button', { name: '＋ Website', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill(url);
  await page.getByRole('button', { name: 'Add to my space', exact: true }).click();
  await page.getByRole('button', { name: '▦ Grid', exact: true }).click();
  // Grid startup must not request the deferred graphics chunk.
  await app.close(); page = await launch();
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(r => /\/Scene-/.test(r.name)))).toBe(false);
  pass('saved grid starts without loading the graphics scene');
  await page.locator('.card-open').click();
  await expect(page.locator('.browser-status')).toContainText('Boundary fixture');
  let remote = app.windows().find(p => p !== page && p.url().startsWith(url));
  await app.evaluate(({ dialog }) => { globalThis.dialogs = []; dialog.showMessageBox = async (_window, options) => { globalThis.dialogs.push(options); return { response: 0 }; }; });
  await remote.getByRole('button', { name: 'Popup', exact: true }).click();
  await expect.poll(() => app.evaluate(() => globalThis.dialogs.length)).toBe(1);
  expect(app.windows()).toHaveLength(2); expect(remote.url()).toBe(`${url}/`); pass('denied popup creates no new window or navigation');
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); });
  await remote.getByRole('button', { name: 'Popup', exact: true }).click();
  await expect(remote.locator('h1')).toHaveText('Accepted popup'); expect(app.windows()).toHaveLength(2); pass('accepted popup uses the current isolated view');
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await expect(remote.locator('h1')).toHaveText('Boundary fixture');
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = () => new Promise(resolve => { globalThis.resolvePopup = resolve; }); });
  await remote.getByRole('button', { name: 'Popup', exact: true }).click();
  await expect.poll(() => app.evaluate(() => typeof globalThis.resolvePopup)).toBe('function');
  await page.getByRole('button', { name: '← Room', exact: true }).click();
  await page.locator('.card-open').click(); await expect(page.locator('.browser-status')).toContainText('Boundary fixture');
  remote = app.windows().find(p => p !== page && p.url().startsWith(url));
  await app.evaluate(() => globalThis.resolvePopup({ response: 1 }));
  expect(remote.url()).toBe(`${url}/`); pass('stale popup decision cannot navigate a replacement view');
  await app.evaluate(({ dialog }) => { globalThis.permissionDialogCount = 0; dialog.showMessageBox = async (_window, options) => { if (options.title === 'Website permission') globalThis.permissionDialogCount++; return { response: 0 }; }; });
  await remote.getByRole('button', { name: 'Request notification' }).click();
  await expect(remote.locator('#permission')).toHaveText('denied'); pass('notification permission is denied without granting OS access');
  const downloadPath = join(artifacts, 'fixture.txt');
  await app.evaluate(({ session }, target) => {
    // Instrument only the deterministic fixture: production still shows its save dialog.
    session.fromPartition('persist:focusspace-sites').on('will-download', (_event, item) => {
      globalThis.downloadOptions = item.getSaveDialogOptions(); item.setSavePath(target);
      item.once('done', (_event, status) => { globalThis.downloadStatus = status; });
    });
  }, downloadPath);
  await remote.getByRole('link', { name: 'Download fixture' }).click();
  await expect.poll(() => app.evaluate(() => globalThis.downloadStatus)).toBe('completed');
  expect(readFileSync(downloadPath, 'utf8')).toBe('FocusSpace deterministic download');
  expect(await app.evaluate(() => globalThis.downloadOptions.title)).toBe('Save website download'); pass('download handler supplies save options and fixture bytes are intact');
  await app.evaluate(({ webContents }, source) => webContents.getAllWebContents().find(w => w.getURL().startsWith(source)).focus(), url);
  await app.evaluate(({ webContents }, source) => {
    const contents = webContents.getAllWebContents().find(w => w.getURL().startsWith(source));
    contents.sendInputEvent({ type: 'keyDown', keyCode: 'F2', modifiers: ['control', 'shift'] });
  }, url);
  await expect(page.locator('.browser-toolbar')).toHaveCount(0); pass('remote keyboard shortcut returns to the trusted room');
  await page.keyboard.press('Control+Shift+P'); const modal = page.getByRole('dialog', { name: 'palette' }); await expect(modal).toBeVisible();
  await page.keyboard.press('Shift+Tab'); expect(await page.evaluate(() => document.activeElement.closest('[role="dialog"]') !== null)).toBe(true);
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); pass('command dialog traps focus and closes with Escape');
  await page.getByRole('button', { name: '◇ Room', exact: true }).click(); await expect(page.locator('.scene-root canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data.preferences.mode)).toBe('3d');
  await app.close();
  page = await launch();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /^webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open Boundary tests' }).click();
  await expect(page.locator('.content-card')).toHaveCount(1, { timeout: 15000 });
  const loaded = await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data);
  expect(loaded.preferences.mode).toBe('2d'); report.gpuFallback = 'automatic grid fallback passed with deterministic unavailable WebGL context; physical hardware unverified';
  pass('unavailable WebGL context automatically restores accessible grid with saved data');
  await page.screenshot({ path: join(artifacts, 'gpu-fallback.png') });
  report.completed = true;
} catch (error) { report.completed = false; report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally {
  if (app) {
    const child = app.process(); const watchdog = setTimeout(() => { report.cleanExit = false; child.kill(); }, 5000);
    try { await app.close(); if (report.cleanExit !== false) report.cleanExit = true; } catch {} finally { clearTimeout(watchdog); }
  }
  server.close(); if (report.cleanExit === false) process.exitCode = 1;
  writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
}

