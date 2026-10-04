import { _electron as electron, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';

const artifactDirectory = resolve('.runtime/smoke'); mkdirSync(artifactDirectory, { recursive: true });
const dataDirectory = mkdtempSync(join(artifactDirectory, 'data-'));
const fixture = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html');
  if (request.url === '/second') response.end('<title>Second fixture</title><main><h1>Second fixture</h1><p>Compare this page with the first fixture.</p></main>');
  else response.end('<title>FocusSpace fixture</title><main><h1>Working website</h1><p>Reliable local fixture about project organization.</p><form><input value="PRIVATE_FORM_VALUE"><textarea>PRIVATE_TEXTAREA_VALUE</textarea></form><div contenteditable>PRIVATE_EDITOR_VALUE</div><button onclick="document.querySelector(\'h1\').textContent=\'Website interaction verified\'">Interact</button><a href="/second">Next page</a></main>');
});
await new Promise(r => fixture.listen(0, '127.0.0.1', r));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
let application;
const report = { dataDirectory, assertions: [], measurements: {}, realBrowsing: 'not attempted', errors: [] };
function passed(value) { report.assertions.push(value); console.log(`PASS ${value}`); }
async function launch() {
  const start = performance.now();
  const env = { ...process.env, FOCUSSPACE_LEGACY: '1', FOCUSSPACE_DATA_DIR: dataDirectory }; delete env.ELECTRON_RUN_AS_NODE;
  application = await electron.launch({ args: ['.'], cwd: process.cwd(), env, timeout: 30000 });
  const page = await application.firstWindow();
  page.on('pageerror', error => report.errors.push(error.message));
  await expect(page.locator('h1')).toBeVisible();
  const persisted = await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data);
  const active = persisted.workspaces.find(w => w.id === persisted.preferences.activeWorkspaceId);
  if (active && !active.archived) await page.getByRole('button', { name: `Open ${active.name}`, exact: true }).click();
  report.measurements.startupMs = Math.round(performance.now() - start);
  return page;
}
async function add(page, kind, value) {
  await page.getByRole('button', { name: `＋ ${kind}`, exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill(value);
  await page.getByRole('button', { name: 'Add to my space', exact: true }).click();
}
async function load(page) { return page.evaluate(async () => { const r = await window.focusspace.call({ type: 'load' }); if (!r.ok) throw new Error(r.error); return r.data; }); }
try {
  let page = await launch();
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('Smoke project');
  await page.getByRole('button', { name: 'Add to my space' }).click();
  await expect(page.getByRole('heading', { name: 'Smoke project', exact: true })).toBeVisible(); passed('create workspace');
  await add(page, 'Website', fixtureUrl);
  await add(page, 'Website', `${fixtureUrl}/second`);
  await add(page, 'Note', 'Persistent note');
  await page.getByRole('textbox', { name: 'Card content' }).fill('Remember the architecture boundary.');
  await add(page, 'Task', 'Persistent next step');
  await page.getByRole('button', { name: 'Toggle project memory' }).click();
  await page.getByRole('textbox', { name: 'Where I left off' }).fill('Testing the desktop workflow.');
  await page.getByRole('button', { name: 'Close card editor' }).click();
  await expect(page.locator('.scene-root canvas')).toBeVisible();
  await expect(page.locator('.scene-label')).toHaveCount(4);
  await page.screenshot({ path: join(artifactDirectory, 'room.png') }); passed('trusted 3D scene renders');
  await page.getByRole('button', { name: 'Arrange cards', exact: true }).click();
  await expect(page.locator('.scene-label').first()).toBeDisabled();
  const originalPositions = (await load(page)).workspaces[0].cards.map(c => c.position);
  const box = await page.locator('.scene-label').first().boundingBox();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .65);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .8, box.y + box.height * .95, { steps: 15 }); await page.mouse.up();
  expect((await load(page)).workspaces[0].cards.map(c => c.position)).not.toEqual(originalPositions); passed('3D dragging changes persisted layout without navigation');
  await page.getByRole('button', { name: 'Finish arranging', exact: false }).click();
  await page.getByRole('button', { name: '▦ Grid', exact: true }).click();
  await expect(page.locator('.content-card')).toHaveCount(4); passed('shared 2D data, note and task updates');
  await page.locator('.content-card').first().locator('.card-open').click();
  await expect(page.locator('.browser-status')).toContainText('FocusSpace fixture', { timeout: 15000 });
  const remote = application.windows().find(p => p !== page && p.url().startsWith(fixtureUrl));
  if (!remote) throw new Error('No isolated website view found.');
  expect(await remote.evaluate(() => ({ node: typeof window.require, bridge: typeof window.focusspace }))).toEqual({ node: 'undefined', bridge: 'undefined' });
  await remote.getByRole('button', { name: 'Interact' }).click(); await expect(remote.locator('h1')).toHaveText('Website interaction verified'); passed('real browser interaction and isolation');
  await remote.getByRole('link', { name: 'Next page' }).click(); await expect(page.locator('.browser-status')).toContainText('Second fixture');
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await expect(remote.locator('h1')).toHaveText('Working website');
  await page.getByRole('button', { name: 'Forward', exact: true }).click(); await expect(remote.locator('h1')).toHaveText('Second fixture');
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await expect(remote.locator('h1')).toHaveText('Working website'); passed('website navigation back and forward');
  const extraction = await page.evaluate(() => window.focusspace.call({ type: 'extract' })); expect(extraction.ok).toBe(true); expect(extraction.data.text).not.toContain('PRIVATE_'); passed('extraction excludes form and editable values');
  const unauthorized = await application.evaluate(async ({ webContents, BrowserWindow }) => {
    const wc = webContents.getAllWebContents().find(c => c.getURL().startsWith('http://127.0.0.1'));
    const window = BrowserWindow.getAllWindows()[0];
    return { remoteHasPreload: wc.getLastWebPreferences().preload, sandbox: wc.getLastWebPreferences().sandbox, trustedIsolated: window.webContents.getLastWebPreferences().contextIsolation };
  });
  expect(unauthorized.remoteHasPreload).toBeUndefined(); expect(unauthorized.sandbox).toBe(true); passed('remote has no preload and is sandboxed');
  const fullWindow = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64'));
  writeFileSync(join(artifactDirectory, 'browser.png'), Buffer.from(fullWindow, 'base64'));
  await remote.screenshot({ path: join(artifactDirectory, 'website.png') });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 700));
  const r = await page.locator('.browser-host').boundingBox();
  const bounds = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.at(-1).getBounds());
  expect(Math.abs(bounds.x - Math.round(r.x))).toBeLessThan(2); expect(Math.abs(bounds.width - Math.round(r.width))).toBeLessThan(2); passed('native browser bounds track resizing');
  await page.getByRole('button', { name: 'Summarize', exact: true }).click();
  await page.getByRole('button', { name: 'Generate labeled demo' }).click();
  await expect(page.locator('.ai-result')).toContainText('DEMO OUTPUT'); passed('explicit summary preview and labeled demo');
  await page.getByRole('button', { name: 'Suggest organization' }).click();
  await page.getByRole('button', { name: 'Generate labeled demo' }).click();
  const before = (await load(page)).workspaces[0].cards.map(c => c.position);
  await page.getByRole('button', { name: 'Accept layout' }).click();
  await page.getByRole('button', { name: 'Undo organization' }).click();
  expect((await load(page)).workspaces[0].cards.map(c => c.position)).toEqual(before); passed('organization preview acceptance and undo');
  await page.getByRole('button', { name: 'Continue where I left off' }).click();
  await page.getByRole('button', { name: 'Generate labeled demo' }).click();
  await expect(page.locator('.ai-result')).toContainText('Persistent next step'); passed('return briefing uses recorded context');
  await page.getByRole('button', { name: 'Settings & data', exact: true }).click();
  const exportPath = join(artifactDirectory, 'export.json');
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, exportPath);
  await page.getByRole('button', { name: 'Export workspaces', exact: true }).click();
  await expect.poll(() => { try { return JSON.parse(readFileSync(exportPath, 'utf8')).workspaces.length; } catch { return 0; } }).toBe(1);
  expect(readFileSync(exportPath, 'utf8')).not.toContain('apiKey');
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Import preview' })).toContainText('Smoke project');
  expect((await load(page)).workspaces).toHaveLength(1);
  await page.getByRole('button', { name: 'Accept import', exact: true }).click();
  await expect.poll(async () => (await load(page)).workspaces.length).toBe(2);
  const imported = (await load(page)).workspaces[1]; expect(imported.id).not.toBe((await load(page)).workspaces[0].id); passed('export and accepted import preserve originals and remap collisions');
  const switchingStart = performance.now();
  await page.getByRole('button', { name: 'Workspaces', exact: true }).click();
  await page.locator('.workspace-nav').filter({ hasText: '(imported)' }).click();
  await expect(page.getByRole('heading', { name: 'Smoke project (imported)', exact: true })).toBeVisible(); report.measurements.workspaceSwitchMs = Math.round(performance.now() - switchingStart);
  await page.getByRole('button', { name: 'Edit workspace' }).click();
  await page.getByRole('button', { name: 'Archive workspace', exact: true }).click();
  await expect(page.locator('.banner')).toContainText('archived');
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Edit workspace' }).click();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Delete workspace', exact: true }).click();
  await expect.poll(async () => (await load(page)).workspaces.length).toBe(1); passed('workspace switch archive restore and confirmed delete');
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveCount(0); await page.getByRole('button', { name: 'Exit focus', exact: true }).click(); passed('focus mode exit is visible');
  await page.keyboard.press('Control+Shift+P');
  await expect(page.getByRole('dialog', { name: 'palette' })).toBeVisible(); await page.keyboard.press('Escape'); passed('command palette shortcut');
  const saved = await load(page); await application.close();
  page = await launch();
  expect(await load(page)).toEqual(saved); await expect(page.getByRole('heading', { name: 'Smoke project', exact: true })).toBeVisible(); passed('SQLite restoration across desktop restart');
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 920));
  await page.screenshot({ path: join(artifactDirectory, 'restored.png') });
  const firstId = saved.workspaces[0].cards[0].id;
  await page.evaluate(async ({ workspaceId, cardId }) => { await window.focusspace.call({ type: 'open', workspaceId, cardId }); }, { workspaceId: saved.workspaces[0].id, cardId: firstId });
  await page.evaluate(() => window.focusspace.call({ type: 'browser', action: 'navigate', url: 'http://127.0.0.1:1/unavailable' }));
  await expect(page.locator('.banner.error')).toContainText('could not load'); passed('unavailable website recovery message');
  await page.getByRole('button', { name: '← Room', exact: true }).click();
  await page.evaluate(async () => { const r = await window.focusspace.call({ type: 'load' }); r.data.preferences.provider = 'openai'; await window.focusspace.call({ type: 'save', state: r.data }); const result = await window.focusspace.call({ type: 'ai', requestId: 'failure', workspaceId: r.data.workspaces[0].id, kind: 'briefing', content: 'test' }); if (result.ok || !result.error.includes('API key')) throw new Error('Expected credential error'); r.data.preferences.provider = 'demo'; await window.focusspace.call({ type: 'save', state: r.data }); }); passed('AI missing credentials error without paid calls');
  try {
    const result = await page.evaluate(async ({ workspaceId, cardId }) => { await window.focusspace.call({ type: 'open', workspaceId, cardId }); return window.focusspace.call({ type: 'browser', action: 'navigate', url: 'https://example.com' }); }, { workspaceId: saved.workspaces[0].id, cardId: firstId });
    await expect(page.locator('.browser-status')).toContainText('Example Domain', { timeout: 15000 }); report.realBrowsing = result.ok ? 'example.com loaded' : 'failed'; passed('public website smoke test');
  } catch (e) { report.realBrowsing = `unverified: ${e.message}`; }
  expect(report.errors).toEqual([]); passed('no renderer errors during workflow'); report.completed = true;
} catch (error) {
  report.completed = false; report.failure = error.stack; console.error(error);
  if (application) { try { await (await application.firstWindow()).screenshot({ path: join(artifactDirectory, 'failure.png') }); } catch {} }
  process.exitCode = 1;
} finally {
  writeFileSync(join(artifactDirectory, 'report.json'), JSON.stringify(report, null, 2));
  if (application) await application.close().catch(() => {}); fixture.close();
}
