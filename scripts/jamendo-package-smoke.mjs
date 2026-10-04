import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
mkdirSync('.runtime/jamendo', { recursive: true });
const directory = mkdtempSync(resolve('.runtime/jamendo/data-'));
const env = { ...process.env, FOCUSSPACE_DATA_DIR: directory }; delete env.ELECTRON_RUN_AS_NODE; delete env.JAMENDO_CLIENT_ID;
let app;
const launch = async () => { app = await electron.launch({ executablePath: resolve(process.env.FOCUSSPACE_PACKAGE_DIR, 'win-unpacked/FocusSpace.exe'), env }); const page = await app.firstWindow(); await page.waitForFunction(() => !!window.focusspace); return page; };
try {
  let page = await launch();
  expect((await page.evaluate(() => window.focusspace.call({ type: 'jamendo-search', options: {} }))).data).toEqual({ configured: false, tracks: [] });
  expect((await page.evaluate(() => window.focusspace.call({ type: 'jamendo-client', clientId: 'fixture-private-client' }))).ok).toBe(true);
  expect(readFileSync(join(directory, 'jamendo-client.enc')).includes(Buffer.from('fixture-private-client'))).toBe(false);
  await app.close(); app = undefined; page = await launch();
  expect((await page.evaluate(() => window.focusspace.call({ type: 'jamendo-status' }))).data.configured).toBe(true);
  await app.evaluate(() => { globalThis.fetch = async () => new Response(JSON.stringify({ headers: { status: 'success' }, results: [] })); });
  expect((await page.evaluate(() => window.focusspace.call({ type: 'jamendo-search', options: { group: 'artist' } }))).data).toEqual({ configured: true, tracks: [] });
  await app.close(); app = undefined;
  writeFileSync(join(directory, 'jamendo-client.enc'), 'unreadable fixture');
  page = await launch();
  const reply = await page.evaluate(() => window.focusspace.call({ type: 'jamendo-search', options: {} }));
  expect(reply.ok).toBe(false); expect(reply.error).toContain('preserved');
  expect(readFileSync(join(directory, 'jamendo-client.enc'), 'utf8')).toBe('unreadable fixture');
  console.log('PASS: encrypted Jamendo ID, restart, trusted IPC query, missing configuration, unreadable credential preservation. Fixture only.');
} finally { if (app) await app.close(); }
