import { fetchMixter } from '../shared/freeMusicRequest';
import { fetchJamendo } from '../shared/jamendo';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Storage } from './storage';
import { Browser } from './browser';
import { SecretStore, demoResult, openAIResult } from './ai';
import { commandSchema, type Event, type Reply } from '../shared/bridge';
import { exportSchema, normalizeUrl, now, record, remapImport, uid, type AppState } from '../shared/model';
import { authorizedSender, rendererDocumentUrl } from '../shared/security';

// Keep the existing data location when changing the public app name.
app.setPath('userData', process.env.FOCUSSPACE_DATA_DIR || app.getPath('userData'));
app.setName('Tuniko');
let storage: Storage | undefined;
let browser: Browser | undefined;
let win: BrowserWindow;
let state: AppState;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let active: { workspaceId: string; cardId: string } | undefined;
const requests = new Map<string, AbortController>();
const imports = new Map<string, unknown>();
const emit = (event: Event) => { if (event.type === 'notice' && event.message === 'Return to workspace') active = undefined; if (!win.isDestroyed()) win.webContents.send('focusspace:event', event); };
const persist = () => { clearTimeout(saveTimer); saveTimer = undefined; storage!.save(state); if (win && !win.isDestroyed()) emit({ type: 'persistence', status: 'saved' }); };
const rendererFile = join(__dirname, '../renderer/index.html');
const trustedUrl = pathToFileURL(rendererFile).href;
app.setAppUserModelId('local.focusspace.desktop');

app.whenReady().then(() => {
  const directory = app.getPath('userData'); mkdirSync(directory, { recursive: true });
  try { storage = new Storage(join(directory, 'focusspace.sqlite')); state = storage.load(); }
  catch { dialog.showErrorBox('Tuniko could not open saved data', `Your files have been preserved in ${directory}. Restore a backup or contact support. The app will not overwrite them.`); app.quit(); return; }
  const jamendoStore = new SecretStore(join(directory, 'jamendo-client.enc'));
  const secrets = new SecretStore(join(directory, 'openai-key.bin'));
  win = new BrowserWindow({ width: 1440, height: 920, minWidth: 900, minHeight: 620, icon: join(__dirname, 'icon.png'), backgroundColor: '#101119', autoHideMenuBar: true, webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  browser = new Browser(win, emit, (url, title) => {
    if (!active) return;
    const w = state.workspaces.find(w => w.id === active!.workspaceId);
    const c = w?.cards.find(c => c.id === active!.cardId);
    if (!w || !c) return;
    if (c.url !== url) { c.url = url; c.updatedAt = now(); record(w, 'url-changed', `Navigated ${c.title}`, c.id); }
    if (title) c.title = title.slice(0, 200);
    persist(); emit({ type: 'state', state });
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (rendererDocumentUrl(url) !== trustedUrl) event.preventDefault(); });
  win.on('closed', () => { browser?.close(); for (const request of requests.values()) request.abort(); });
  ipcMain.handle('focusspace:command', async (event, raw): Promise<Reply> => {
    if (!authorizedSender(event.sender.id, win.webContents.id, rendererDocumentUrl(event.senderFrame?.url ?? ''), trustedUrl, event.senderFrame === win.webContents.mainFrame)) return { ok: false, error: 'Unauthorized request.' };
    try {
      const cmd = commandSchema.parse(raw);
      switch (cmd.type) {
        case 'jamendo-status': return { ok: true, data: { configured: !!process.env.JAMENDO_CLIENT_ID || jamendoStore.has(), secure: jamendoStore.available() } };
        case 'jamendo-client': jamendoStore.set(cmd.clientId); return { ok: true, data: null };
        case 'jamendo-search': {
          const store = jamendoStore;
          let clientId = process.env.JAMENDO_CLIENT_ID;
          if (!clientId && store.has()) { try { clientId = store.get(); } catch { throw new Error('Jamendo credentials could not be read; the stored copy is preserved.'); } }
          return { ok: true, data: await fetchJamendo(clientId, cmd.options) };
        }
        case 'save-song-card': {
          const png = Buffer.from(cmd.data, 'base64');
          if (png.length < 24 || png.length > 4_500_000 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) !== 1080 || png.readUInt32BE(20) !== (cmd.format === 'story' ? 1920 : 1080)) throw new Error('Invalid song card.');
          browser!.hide();
          try {
            const result = await dialog.showSaveDialog(win, { title: 'Save song card', defaultPath: `Tuniko-${cmd.format}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] });
            if (!result.canceled && result.filePath) writeFileSync(result.filePath, png);
            return { ok: true, data: !result.canceled };
          } finally { browser!.show(); }
        }
        case 'music-search': return { ok: true, data: await fetchMixter(cmd.query, cmd.discover) };
        case 'load': return { ok: true, data: state };
        case 'save': {
          // Browser navigation is authoritative while its view is open. UI snapshots
          // can otherwise race a page-title or navigation event.
          if (active) {
            const live = state.workspaces.find(w => w.id === active!.workspaceId)?.cards.find(c => c.id === active!.cardId);
            const incoming = cmd.state.workspaces.find(w => w.id === active!.workspaceId)?.cards.find(c => c.id === active!.cardId);
            if (live && incoming) { incoming.url = live.url; incoming.title = live.title; }
          }
          state = cmd.state; clearTimeout(saveTimer); emit({ type: 'persistence', status: 'saving' });
          saveTimer = setTimeout(() => { try { persist(); } catch { emit({ type: 'persistence', status: 'error' }); emit({ type: 'notice', message: 'Changes could not be saved. Keep the app open, free disk space, and use Retry save.' }); } }, 200);
          return { ok: true, data: null };
        }
        case 'browse': { const url = normalizeUrl(cmd.url); active = undefined; await browser!.open('music-browser', url); return { ok: true, data: null }; }
        case 'open': {
          const w = state.workspaces.find(w => w.id === cmd.workspaceId && !w.archived);
          const c = w?.cards.find(c => c.id === cmd.cardId && c.kind === 'website');
          if (!w || !c?.url) throw new Error('This website card is unavailable.');
          active = { workspaceId: w.id, cardId: c.id }; w.lastUsedAt = now(); record(w, 'website-opened', `Opened ${c.title}`, c.id); persist(); emit({ type: 'state', state });
          await browser!.open(c.id, c.url); return { ok: true, data: null };
        }
        case 'browser': if (cmd.action === 'navigate') await browser!.navigate(cmd.url ?? ''); else { browser!.action(cmd.action); if (cmd.action === 'close') active = undefined; } return { ok: true, data: null };
        case 'bounds': browser!.bounds(cmd.rect); return { ok: true, data: null };
        case 'extract': return { ok: true, data: await browser!.extract() };
        case 'key-status': return { ok: true, data: { hasKey: secrets.has(), available: secrets.available() } };
        case 'key': secrets.set(cmd.key); return { ok: true, data: null };
        case 'cancel': requests.get(cmd.requestId)?.abort(); return { ok: true, data: null };
        case 'ai': {
          const w = state.workspaces.find(w => w.id === cmd.workspaceId); if (!w) throw new Error('Workspace not found.');
          if (requests.size) throw new Error('An assistant request is already running. Cancel it or wait.');
          if (state.preferences.provider === 'demo') return { ok: true, data: demoResult(cmd.kind, w, cmd.content) };
          const controller = new AbortController(); requests.set(cmd.requestId, controller);
          const timeout = setTimeout(() => controller.abort(), 45000);
          try { return { ok: true, data: await openAIResult(cmd.kind, w, cmd.content, state.preferences.model, secrets.get(), controller.signal) }; }
          catch (error) { if (controller.signal.aborted) throw new Error('Request canceled or timed out. Retry when ready.'); throw error; }
          finally { clearTimeout(timeout); requests.delete(cmd.requestId); }
        }
        case 'export': {
          browser!.hide();
          try { const result = await dialog.showSaveDialog(win, { defaultPath: 'focusspace-export.json', filters: [{ name: 'JSON', extensions: ['json'] }] }); if (!result.canceled && result.filePath) writeFileSync(result.filePath, JSON.stringify({ format: 'focusspace', version: 1, workspaces: state.workspaces }, null, 2)); return { ok: true, data: !result.canceled }; }
          finally { browser!.show(); }
        }
        case 'import-preview': {
          browser!.hide();
          try { const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] }); if (result.canceled) return { ok: true, data: null };
            const file = readFileSync(result.filePaths[0]); if (file.length > 5_000_000) throw new Error('Import file is too large (maximum 5 MB).');
            const imported = exportSchema.parse(JSON.parse(file.toString())); const token = uid(); imports.clear(); imports.set(token, imported); return { ok: true, data: { token, workspaces: imported.workspaces.map(w => ({ name: w.name, count: w.cards.length })) } };
          } finally { browser!.show(); }
        }
        case 'import-accept': {
          const rawImport = imports.get(cmd.token); if (!rawImport) throw new Error('Import preview expired. Select the file again.');
          const workspaces = remapImport(rawImport); if (state.workspaces.length + workspaces.length > 100) throw new Error('Workspace limit reached.');
          state.workspaces.push(...workspaces); persist(); imports.delete(cmd.token); emit({ type: 'state', state }); return { ok: true, data: state };
        }
      }
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'The action failed. Try again.' }; }
  });
  void win.loadFile(rendererFile, process.env.FOCUSSPACE_LEGACY === '1' ? { query: { legacy: '1' } } : {});
}).catch(() => { dialog.showErrorBox('Tuniko startup failed', 'The desktop runtime could not start. Your saved data has not been replaced.'); app.quit(); });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', event => {
  if (!storage) return;
  try { persist(); storage.close(); storage = undefined; }
  catch { event.preventDefault(); dialog.showErrorBox('Changes could not be saved', 'Tuniko could not write your latest changes. Free disk space and retry. Previously saved data has been preserved.'); }
});
