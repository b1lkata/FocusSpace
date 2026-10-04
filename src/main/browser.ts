import { BrowserWindow, WebContentsView, dialog, session } from 'electron';
import { normalizeUrl } from '../shared/model';
import type { BrowserState, Event } from '../shared/bridge';
import { sameDocument, websiteOrigin, type DocumentIdentity } from '../shared/permissions';

export const extractionScript = `(() => {
  const root = document.querySelector('main, article, [role="main"]') || document.body;
  if (!root) return '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts = []; let length = 0; let node;
  while ((node = walker.nextNode()) && length < 12000) {
    const el = node.parentElement;
    if (!el || el.closest('script,style,noscript,input,textarea,select,form,[contenteditable],nav,header,footer,[hidden],[aria-hidden="true"]')) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const value = node.textContent.trim();
    if (value) { parts.push(value); length += value.length; }
  }
  return parts.join(' ').slice(0,12000);
})()`;

export class Browser {
  private view?: WebContentsView;
  private current?: BrowserState;
  private rect = { x: 240, y: 170, width: 700, height: 500 };
  private attached = false;
  private navigation = 0;
  private documentRevision = 0;
  private granted = new Set<string>();
  constructor(private window: BrowserWindow, private emit: (event: Event) => void, private update: (url: string, title: string) => void) {
    const siteSession = session.fromPartition('persist:focusspace-sites');
    siteSession.setPermissionCheckHandler((contents, permission, origin, details) => contents === this.view?.webContents && details.isMainFrame && websiteOrigin(origin) === websiteOrigin(contents?.getURL() ?? '') && this.granted.has(`${websiteOrigin(origin)}:${permission}`));
    siteSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
      const identity = this.identity(); const origin = websiteOrigin(details.requestingUrl);
      if (contents !== this.view?.webContents || !details.isMainFrame || !origin || origin !== websiteOrigin(identity?.url ?? '') || !['notifications', 'media', 'geolocation', 'fullscreen'].includes(permission)) return callback(false);
      try {
        const answer = await dialog.showMessageBox(this.window, { type: 'question', title: 'Website permission', message: `Allow ${permission} for ${origin}?`, buttons: ['Deny', 'Allow once'], defaultId: 0, cancelId: 0 });
        const allow = answer.response === 1 && !!identity && sameDocument(identity, this.identity());
        if (allow) this.granted.add(`${origin}:${permission}`);
        callback(allow);
      } catch { callback(false); }
    });
    siteSession.on('will-download', (event, item, contents) => {
      if (contents !== this.view?.webContents) { event.preventDefault(); return; }
      // Electron's built-in save dialog keeps the item lifecycle synchronous.
      item.setSaveDialogOptions({ title: 'Save website download', defaultPath: item.getFilename() });
    });
    window.on('resize', () => this.resize());
  }
  private identity(): DocumentIdentity | undefined {
    const contents = this.view?.webContents;
    return contents && !contents.isDestroyed() ? { contentsId: contents.id, url: contents.getURL(), revision: this.documentRevision } : undefined;
  }
  private publish(): void {
    if (!this.current || !this.view || this.view.webContents.isDestroyed()) return;
    const wc = this.view.webContents;
    this.current = { ...this.current, url: wc.getURL() || this.current.url, title: wc.getTitle() || this.current.title, loading: wc.isLoading(), back: wc.navigationHistory.canGoBack(), forward: wc.navigationHistory.canGoForward() };
    this.emit({ type: 'browser', state: this.current });
  }
  async open(cardId: string, url: string): Promise<void> {
    this.close();
    this.current = { cardId, url: normalizeUrl(url), title: 'Loading…', loading: true, back: false, forward: false };
    this.view = new WebContentsView({ webPreferences: { partition: 'persist:focusspace-sites', nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false } });
    const wc = this.view.webContents;
    wc.setWindowOpenHandler(details => {
      let target: string;
      try { target = normalizeUrl(details.url); } catch { this.emit({ type: 'notice', message: 'This popup uses an unsupported address type.' }); return { action: 'deny' }; }
      const identity = this.identity();
      void dialog.showMessageBox(this.window, { type: 'question', title: 'Website opened a link', message: `Open this link in the active card?\n${target}`, buttons: ['Cancel', 'Open'], defaultId: 0, cancelId: 0 }).then(async answer => {
        if (answer.response === 1 && identity && sameDocument(identity, this.identity())) await this.navigate(target);
      }).catch(() => { /* Closed dialogs do not authorize navigation. */ });
      return { action: 'deny' };
    });
    wc.on('did-start-navigation', details => { if (details.isMainFrame && !details.isSameDocument) { this.documentRevision++; this.granted.clear(); } });
    wc.on('will-navigate', (event, target) => { try { normalizeUrl(target); } catch { event.preventDefault(); this.emit({ type: 'notice', message: 'This link uses an unsupported address type.' }); } });
    wc.on('will-redirect', (event, target) => { try { normalizeUrl(target); } catch { event.preventDefault(); } });
    wc.on('did-start-loading', () => { if (this.current) this.current.error = undefined; this.publish(); });
    wc.on('did-stop-loading', () => this.publish());
    const syncPage = () => {
      if (this.view?.webContents !== wc || wc.isDestroyed()) return;
      const url = wc.getURL(); if (!websiteOrigin(url)) return;
      this.update(url, wc.getTitle()); this.publish();
    };
    wc.on('page-title-updated', syncPage);
    wc.on('did-navigate', syncPage);
    wc.on('did-navigate-in-page', (_event, _target, main) => { if (main) syncPage(); });
    wc.on('did-fail-load', (_event, code, _description, _url, main) => { if (main && code !== -3 && this.current) { this.current.error = 'This page could not load. Check the address or connection, then retry.'; this.publish(); } });
    wc.on('render-process-gone', () => { if (this.current) { this.current.error = 'The website stopped responding. Reload to recover.'; this.publish(); } });
    wc.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F2' && input.control && input.shift) { event.preventDefault(); this.emit({ type: 'notice', message: 'Return to workspace' }); this.close(); this.window.webContents.focus(); }
    });
    this.window.contentView.addChildView(this.view); this.attached = true; this.resize(); this.publish();
    await this.navigate(url);
  }
  async navigate(input: string): Promise<void> {
    const url = normalizeUrl(input);
    if (!this.view) throw new Error('Open a website card first.');
    const view = this.view; const navigation = ++this.navigation;
    try { await view.webContents.loadURL(url); }
    catch (error) {
      if (view !== this.view || navigation !== this.navigation || (error instanceof Error && error.message.includes('ERR_ABORTED'))) return;
      if (this.current) { this.current.error = 'This page could not load. Check the address or connection, then retry.'; this.publish(); }
    }
  }
  bounds(rect: typeof this.rect): void { this.rect = rect; this.resize(); }
  private resize(): void {
    const [width, height] = this.window.getContentSize();
    this.view?.setBounds({ x: Math.min(this.rect.x, width), y: Math.min(this.rect.y, height), width: Math.max(0, Math.min(this.rect.width, width - this.rect.x)), height: Math.max(0, Math.min(this.rect.height, height - this.rect.y)) });
  }
  action(action: 'back' | 'forward' | 'reload' | 'close'): void {
    if (action === 'close') return this.close();
    if (!this.view) return;
    const wc = this.view.webContents;
    if (action === 'reload') wc.reload();
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  }
  async extract(): Promise<{ cardId: string; url: string; title: string; text: string }> {
    if (!this.view || !this.current || this.current.error) throw new Error('Open a readable page first.');
    const wc = this.view.webContents;
    const source = { cardId: this.current.cardId, url: wc.getURL(), title: wc.getTitle() };
    const value: unknown = await wc.executeJavaScript(extractionScript, false);
    if (source.url !== wc.getURL()) throw new Error('The page changed during extraction. Try again.');
    if (typeof value !== 'string' || !value.trim()) throw new Error('No readable text was found. This page may require sign-in or use unsupported content.');
    return { ...source, text: value.slice(0, 12000) };
  }
  hide(): void { if (this.view && this.attached) { if (!this.window.isDestroyed()) this.window.contentView.removeChildView(this.view); this.attached = false; } }
  show(): void { if (this.view && !this.attached) { this.window.contentView.addChildView(this.view); this.attached = true; this.resize(); } }
  close(): void {
    this.navigation++;
    this.documentRevision++;
    this.granted.clear();
    this.hide();
    const view = this.view; this.view = undefined; this.current = undefined;
    if (view && !view.webContents.isDestroyed()) view.webContents.close();
  }
}
