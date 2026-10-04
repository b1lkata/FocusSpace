import { commandSchema, type Bridge, type BrowserState, type Event, type Reply } from '../shared/bridge';
import { demoWorkspace, emptyState, exportSchema, now, record, remapImport, stateSchema, uid, type AppState } from '../shared/model';
import { demoResult } from '../shared/demoAI';

export const PREVIEW_STORAGE_KEY = 'focusspace.browser-preview.v1';
type PreviewIO = {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  pickImport: () => Promise<string | null>;
  downloadExport: (content: string) => void;
};

export function createPreviewBridge(io: PreviewIO): Bridge {
  const listeners = new Set<(event: Event) => void>();
  const imports = new Map<string, unknown>();
  let state: AppState | undefined;
  let browser: BrowserState | undefined;
  const emit = (event: Event) => listeners.forEach(listener => listener(structuredClone(event)));
  function load(): AppState {
    if (state) return state;
    let raw: string | null;
    try { raw = io.storage.getItem(PREVIEW_STORAGE_KEY); }
    catch { throw new Error('Browser storage is unavailable. Allow local storage for this preview, then retry.'); }
    if (raw !== null) {
      try { state = stateSchema.parse(JSON.parse(raw)); state.preferences.provider = 'demo'; }
      catch { throw new Error('Saved preview data could not be opened. It has been preserved. Export or back it up before clearing browser storage.'); }
      return state;
    }
    const initial = emptyState(), demo = demoWorkspace();
    initial.workspaces.push(demo); initial.preferences.activeWorkspaceId = demo.id;
    save(initial, false);
    return state!;
  }
  function save(next: AppState, retainDraftOnFailure = true) {
    const validated = stateSchema.parse(next);
    validated.preferences.provider = 'demo';
    // Retain an unsaved edit in memory so export/retry can recover it after quota errors.
    // Imports remain atomic: failed acceptance must not add duplicate projects on retry.
    if (retainDraftOnFailure) state = validated;
    emit({ type: 'persistence', status: 'saving' });
    try { io.storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(validated)); }
    catch { emit({ type: 'persistence', status: 'error' }); throw new Error('Preview changes could not be saved. Browser storage may be full or blocked. Export your work before closing.'); }
    state = validated;
    emit({ type: 'persistence', status: 'saved' });
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async call(raw): Promise<Reply> {
      try {
        const command = commandSchema.parse(raw);
        const current = load();
        switch (command.type) {
          case 'jamendo-status': return { ok: true, data: { configured: false, secure: false } };
          case 'jamendo-client': return { ok: false, error: 'Configure Jamendo on the desktop or music server.' };
          case 'jamendo-search': return { ok: false, error: 'Use the music server connection.' };
          case 'save-song-card': return { ok: false, error: 'Use the card download in browser previews.' };
          case 'music-search': return { ok: false, error: 'Use the free music search.' };
      case 'load': return { ok: true, data: structuredClone(current) };
          case 'browse': throw new Error('Use an explicit website link in the browser preview. Embedded music browsing is available in the desktop app.');
          case 'save': save(command.state); return { ok: true, data: null };
          case 'open': {
            const next = structuredClone(current);
            const workspace = next.workspaces.find(workspace => workspace.id === command.workspaceId && !workspace.archived);
            const card = workspace?.cards.find(card => card.id === command.cardId && card.kind === 'website');
            if (!workspace || !card?.url) throw new Error('This website card is unavailable.');
            workspace.lastUsedAt = now(); record(workspace, 'website-card-viewed', `Viewed ${card.title}`, card.id);
            save(next, false); browser = { cardId: card.id, url: card.url, title: card.title, loading: false, back: false, forward: false };
            emit({ type: 'state', state: next }); emit({ type: 'browser', state: browser });
            return { ok: true, data: null };
          }
          case 'browser':
            if (command.action !== 'close') throw new Error('Embedded website navigation is available in the desktop app. Use Open site in new tab in this preview.');
            browser = undefined; return { ok: true, data: null };
          case 'bounds': return { ok: true, data: null };
          case 'extract': throw new Error('This preview cannot read external websites. Page summaries are available in the desktop app.');
          case 'ai': {
            const workspace = current.workspaces.find(workspace => workspace.id === command.workspaceId);
            if (!workspace) throw new Error('Workspace not found.');
            return { ok: true, data: demoResult(command.kind, workspace, command.content) };
          }
          case 'cancel': return { ok: true, data: null };
          case 'key-status': return { ok: true, data: { hasKey: false, available: false } };
          case 'key': throw new Error('API keys are supported only in the desktop app. Browser preview uses the local demo assistant.');
          case 'export':
            io.downloadExport(JSON.stringify({ format: 'focusspace', version: 1, workspaces: current.workspaces }, null, 2));
            return { ok: true, data: true };
          case 'import-preview': {
            const content = await io.pickImport();
            if (content === null) return { ok: true, data: null };
            if (new TextEncoder().encode(content).length > 5_000_000) throw new Error('Import file is too large (maximum 5 MB).');
            const imported = exportSchema.parse(JSON.parse(content)), token = uid();
            imports.clear(); imports.set(token, imported);
            return { ok: true, data: { token, workspaces: imported.workspaces.map(workspace => ({ name: workspace.name, count: workspace.cards.length })) } };
          }
          case 'import-accept': {
            const imported = imports.get(command.token);
            if (!imported) throw new Error('Import preview expired. Select the file again.');
            const next = structuredClone(current), workspaces = remapImport(imported);
            if (next.workspaces.length + workspaces.length > 100) throw new Error('Workspace limit reached.');
            next.workspaces.push(...workspaces); save(next, false); imports.delete(command.token);
            emit({ type: 'state', state: next }); return { ok: true, data: structuredClone(next) };
          }
        }
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'The preview action failed. Try again.' }; }
    },
  };
}
