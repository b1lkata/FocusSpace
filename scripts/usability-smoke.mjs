import { _electron as electron, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const artifacts = resolve('.runtime/usability'); mkdirSync(artifacts, { recursive: true });
const dataDirectory = mkdtempSync(join(artifacts, 'data-'));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/session' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 2048) request.destroy(); });
    request.on('end', () => {
      const form = new URLSearchParams(body);
      if (form.get('username') !== 'fixture-user' || form.get('password') !== 'local-fixture-only') { response.statusCode = 403; response.end('Fixture credentials rejected'); return; }
      response.writeHead(303, { 'Set-Cookie': 'focusspace_fixture=signed-in; HttpOnly; SameSite=Lax; Max-Age=3600; Path=/', Location: '/account' }); response.end();
    });
    return;
  }
  if (request.url === '/account') {
    const signedIn = request.headers.cookie?.split(';').some(value => value.trim() === 'focusspace_fixture=signed-in');
    response.end(signedIn ? '<title>Fixture account</title><main><h1>Signed in locally</h1><p>Only a deterministic local test account.</p><button>Account action fixture</button></main>' : '<title>Fixture login needed</title><main><h1>Sign in required</h1><a href="/login">Sign in</a></main>');
    return;
  }
  response.end('<title>Fixture sign in</title><main><h1>Local authentication fixture</h1><form method="post" action="/session"><label>Username<input name="username" autocomplete="off"></label><label>Password<input type="password" name="password" autocomplete="off"></label><button>Sign in locally</button></form></main>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const report = { assertions: [], errors: [], sizes: [], authentication: 'local fixture only; public/OAuth flows unverified' };
let app, page;
const pass = value => { report.assertions.push(value); console.log(`PASS ${value}`); };
async function launch() {
  const env = { ...process.env, FOCUSSPACE_LEGACY: '1', FOCUSSPACE_DATA_DIR: dataDirectory }; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: ['.'], env });
  app.process().stderr.on('data', value => { if (/Uncaught Exception|TypeError|Object has been destroyed/.test(value.toString())) report.errors.push(value.toString()); });
  page = await app.firstWindow(); page.on('pageerror', error => report.errors.push(error.message));
  await expect(page.locator('h1')).toBeVisible();
  const persisted = await page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data);
  const active = persisted.workspaces.find(w => w.id === persisted.preferences.activeWorkspaceId);
  if (active && !active.archived) await page.getByRole('button', { name: `Open ${active.name}`, exact: true }).click();
}
async function close() {
  const child = app.process();
  const watchdog = setTimeout(() => { report.cleanExit = false; child.kill(); }, 5000);
  try { await app.close(); } finally { clearTimeout(watchdog); }
}
async function load() { return page.evaluate(async () => (await window.focusspace.call({ type: 'load' })).data); }
async function audit(name) {
  // Electron rejects Target.createTarget, used by axe's normal finishing page.
  // The trusted app has no iframe content; audit it in the supported single-page mode.
  const results = await new AxeBuilder({ page }).setLegacyMode().withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  report.accessibility ??= [];
  report.accessibility.push({ name, passedRules: results.passes.length, violations: results.violations.map(rule => ({ id: rule.id, impact: rule.impact, nodes: rule.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })), manualReviewRules: results.incomplete.map(rule => rule.id) });
  expect(results.violations.map(rule => rule.id)).toEqual([]);
}
async function command(search) {
  await page.keyboard.press('Control+Shift+P');
  const input = page.getByRole('textbox', { name: 'Search commands and content' });
  await expect(input).toBeFocused(); await input.fill(search); await input.press('Enter');
}
try {
  await launch();
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(name).toBeFocused(); await name.fill('Keyboard and account fixtures'); await name.press('Enter');
  await page.getByRole('button', { name: '▦ Grid', exact: true }).click();
  await command('Create a note');
  await expect(name).toBeFocused(); await name.fill('Continuity note'); await name.press('Enter');
  await page.getByRole('textbox', { name: 'Card content' }).fill('The unique search phrase is nebula continuity.');
  await page.getByRole('button', { name: 'Close card editor' }).click();
  await command('nebula continuity');
  await expect(page.getByRole('textbox', { name: 'Card content' })).toHaveValue('The unique search phrase is nebula continuity.');
  pass('keyboard commands create notes and search their saved body text');
  const trigger = page.locator('[data-command-trigger]'); await trigger.focus(); await trigger.press('Enter');
  const modal = page.getByRole('dialog', { name: 'palette' }); await expect(modal).toBeVisible();
  expect(await page.locator('[data-modal-background]').evaluateAll(elements => elements.every(element => element.inert))).toBe(true);
  const input = page.getByRole('textbox', { name: 'Search commands and content' });
  await input.press('ArrowDown'); await expect(modal.getByRole('button', { name: 'Add a website', exact: false })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(modal.locator('.palette-results button').last()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(modal.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.locator('[data-modal-background]').evaluateAll(elements => elements.every(element => !element.inert))).toBe(true);
  pass('dialog background is inert, arrow navigation wraps, Tab is contained and focus returns');

  await command('Add a website'); await page.getByRole('dialog').getByRole('textbox').fill(`${url}/login`); await page.getByRole('button', { name: 'Add to my space' }).click();
  await page.locator('.content-card').filter({ hasText: `${url}/login` }).locator('.card-open').click();
  await expect(page.locator('.browser-status')).toContainText('Fixture sign in');
  let remote = app.windows().find(candidate => candidate !== page && candidate.url().startsWith(url));
  await remote.getByRole('textbox', { name: 'Username' }).fill('fixture-user');
  await remote.getByLabel('Password').fill('local-fixture-only');
  const extraction = await page.evaluate(() => window.focusspace.call({ type: 'extract' }));
  expect(extraction.ok).toBe(true); expect(extraction.data.text).not.toContain('fixture-user'); expect(extraction.data.text).not.toContain('local-fixture-only');
  await remote.getByRole('button', { name: 'Sign in locally' }).click(); await expect(remote.locator('h1')).toHaveText('Signed in locally');
  const cookies = await app.evaluate(async ({ session }, target) => (await session.fromPartition('persist:focusspace-sites').cookies.get({ url: target })).map(cookie => ({ name: cookie.name, httpOnly: cookie.httpOnly })), url);
  expect(cookies).toContainEqual({ name: 'focusspace_fixture', httpOnly: true });
  pass('local form sign-in redirects successfully and secrets are excluded from extraction');
  await page.getByRole('button', { name: '← Room', exact: true }).click();
  await page.locator('.content-card').filter({ hasText: 'Fixture account' }).locator('.card-open').click();
  await expect(page.locator('.browser-status')).toContainText('Fixture account');
  remote = app.windows().find(candidate => candidate !== page && candidate.url().startsWith(url));
  await expect(remote.locator('h1')).toHaveText('Signed in locally');
  await close(); await launch();
  await page.locator('.content-card').filter({ hasText: 'Fixture account' }).locator('.card-open').click();
  await expect(page.locator('.browser-status')).toContainText('Fixture account');
  remote = app.windows().find(candidate => candidate !== page && candidate.url().startsWith(url)); await expect(remote.locator('h1')).toHaveText('Signed in locally');
  expect(await remote.evaluate(() => ({ bridge: typeof window.focusspace, node: typeof window.require }))).toEqual({ bridge: 'undefined', node: 'undefined' });
  pass('HttpOnly fixture session survives view recreation and app restart without an app bridge');

  for (const size of [[900, 620], [1000, 700]]) {
    await app.evaluate(({ BrowserWindow }, dimensions) => BrowserWindow.getAllWindows()[0].setSize(...dimensions), size);
    await expect(page.getByRole('textbox', { name: 'Website address' })).toBeInViewport();
    await expect(page.getByRole('button', { name: '← Room', exact: true })).toBeInViewport();
    await expect.poll(async () => {
      const host = await page.locator('.browser-host').boundingBox();
      const native = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0].getBounds());
      return Math.abs(native.x - Math.round(host.x)) < 2 && Math.abs(native.y - Math.round(host.y)) < 2 && Math.abs(native.width - Math.round(host.width)) < 2 && Math.abs(native.height - Math.round(host.height)) < 2 && native.height > 150;
    }).toBe(true);
    await expect(remote.locator('h1')).toHaveText('Signed in locally');
    await page.screenshot({ path: join(artifacts, `browser-chrome-${size.join('x')}.png`) });
  }
  await remote.screenshot({ path: join(artifacts, 'authenticated-fixture.png') });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 920));
  pass('browser controls and isolated view geometry fit small desktop windows');

  await page.getByRole('textbox', { name: 'Website address' }).focus(); await page.keyboard.press('Control+Shift+P');
  await expect(page.getByRole('dialog', { name: 'palette' })).toBeVisible();
  expect(app.windows().filter(candidate => candidate.url().startsWith(url))).toHaveLength(0);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length)).toBe(0);
  await page.keyboard.press('Escape');
  pass('trusted shortcut closes the native website before presenting its dialog');

  await page.getByRole('button', { name: 'Close card editor' }).click();
  await page.getByRole('button', { name: '◇ Room', exact: true }).click();
  await expect(page.locator('.scene-root canvas')).toBeVisible(); await expect(page.locator('.scene-label')).toHaveCount(2);
  const before = (await load()).workspaces[0].cards.map(card => ({ id: card.id, position: card.position, body: card.body }));
  const lost = await page.locator('.scene-root canvas').evaluate(canvas => { const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context'); if (!extension) return false; extension.loseContext(); return true; });
  expect(lost).toBe(true);
  await expect(page.locator('.content-card')).toHaveCount(2); await expect(page.getByRole('status')).toContainText('Your cards are safe');
  expect((await load()).workspaces[0].cards.map(card => ({ id: card.id, position: card.position, body: card.body }))).toEqual(before);
  pass('real renderer context loss returns to Grid and preserves card content and layout');
  await page.getByRole('button', { name: 'Dismiss message' }).click();
  await page.locator('.content-card').filter({ hasText: 'Continuity note' }).locator('.card-open').click();
  for (const [width, height] of [[900, 620], [1000, 700], [1280, 800], [1440, 920]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    report.lastLayout = await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], panes: Object.fromEntries(['.main-header', '.workspace-toolbar', '.workspace-canvas', '.editor', '.main-footer'].map(selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return [selector, r ? { top: r.top, bottom: r.bottom, height: r.height } : null]; })) }));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => page.locator('.main-footer').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
    await expect(page.getByRole('textbox', { name: 'Card title' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Toggle project memory' })).toBeInViewport();
    report.sizes.push({ requested: [width, height], content: await page.evaluate(() => [innerWidth, innerHeight]) });
    await page.screenshot({ path: join(artifacts, `grid-${width}x${height}.png`) });
  }
  pass('grid editor and essential controls fit four common desktop window sizes');
  await audit('grid with note editor and project memory');
  await page.locator('[data-command-trigger]').click(); await audit('command palette dialog'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings & data', exact: true }).click(); await audit('settings dialog'); await page.keyboard.press('Escape');
  pass('automated accessibility scans find no violations in grid, command and settings states');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.getByRole('button', { name: 'Focus', exact: true }).evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  await page.getByRole('button', { name: 'Focus', exact: true }).click(); await expect(page.getByRole('button', { name: 'Exit focus', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeVisible();
  pass('reduced-motion preference removes transitions and focus mode exits with Escape');
  expect(report.errors).toEqual([]); report.completed = true;
} catch (error) { report.completed = false; report.failure = error.stack; await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {}); console.error(error); process.exitCode = 1; }
finally {
  if (app) { try { await close(); if (report.cleanExit !== false) report.cleanExit = true; } catch (error) { report.cleanExit = false; report.closeFailure = error.message; process.exitCode = 1; } }
  server.close(); if (report.cleanExit === false) process.exitCode = 1;
  writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
}
