import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const output = resolve('.runtime/song-share/package'); mkdirSync(output, { recursive: true });
const env = { ...process.env, FOCUSSPACE_DATA_DIR: mkdtempSync(resolve(output, 'data-')) }; delete env.ELECTRON_RUN_AS_NODE; delete env.FOCUSSPACE_LEGACY;
const app = await electron.launch({ executablePath: resolve(process.env.FOCUSSPACE_PACKAGE_DIR, 'win-unpacked/FocusSpace.exe'), env });
try {
  const page = await app.firstWindow();
  await expect(page.locator('h1')).toContainText('good sounds');
  await expect(page.getByLabel('Import audio files')).toBeEnabled();
  await page.getByLabel('Import audio files').setInputFiles({ name: 'Packaged share.mp3', mimeType: 'audio/mpeg', buffer: readFileSync('tests/fixtures/original-tone.mp3') });
  await page.getByRole('button', { name: 'Play audio Packaged share', exact: true }).click();
  await page.getByRole('button', { name: 'Share song ↗' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this song' });
  await expect.poll(() => dialog.getByRole('img').evaluate(img => img.naturalHeight)).toBe(1920);
  await dialog.getByRole('button', { name: 'Copy song', exact: true }).click();
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toContain('Packaged share');
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, resolve(output, 'story.png'));
  await dialog.getByRole('button', { name: 'Save card' }).click(); await expect(dialog.getByRole('status')).toContainText('Card saved');
  const png = readFileSync(resolve(output, 'story.png')); expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1920]);
  await page.screenshot({ path: resolve(output, 'dialog.png') }); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  console.log('PASS packaged story preview, clipboard caption, actual PNG download and modal close; app closed.');
} finally { await app.close(); }
