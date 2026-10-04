import { _android, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const output = '.runtime/android-public'; mkdirSync(output, { recursive: true });
const adb = resolve('.runtime/android-tools/sdk/platform-tools/adb.exe');
const shell = (...args) => execFileSync(adb, ['-s', 'emulator-5554', 'shell', ...args], { encoding: 'utf8' });
const [device] = (await _android.devices()).filter(d => d.serial() === 'emulator-5554');
if (!device) throw new Error('Only isolated emulator-5554 may run this public-network check.');
const report = { network: 'unverified', physicalDevice: 'unverified' };
try {
  shell('input', 'keyevent', '224'); shell('wm', 'dismiss-keyguard'); shell('am', 'start', '-n', 'local.focusspace.mobile/.MainActivity');
  const page = await (await device.webView({ pkg: 'local.focusspace.mobile' })).page();
  await page.getByRole('combobox', { name: 'Search free music' }).fill('lofi'); await page.locator('#catalog-search-form').getByRole('button', { name: 'Search', exact: true }).click();
  const stream = page.getByRole('button', { name: /^Stream / }).first();
  await stream.waitFor({ timeout: 25000 });
  report.song = await stream.getAttribute('aria-label'); await stream.click();
  await expect.poll(async () => (await page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'state', {}))).time, { timeout: 25000 }).toBeGreaterThan(.2);
  report.native = await page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'state', {}));
  report.network = 'actual public Audius discovery and native Android stream passed';
  await page.evaluate(() => window.Capacitor.nativePromise('FocusAudio', 'stop', {}));
} catch (error) { report.network = 'unavailable or failed'; report.detail = error.message; }
finally { shell('am', 'force-stop', 'local.focusspace.mobile'); await device.close(); writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); console.log(report); }
