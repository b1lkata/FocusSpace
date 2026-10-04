import { describe, expect, it, vi } from 'vitest';
import { createPreviewBridge, PREVIEW_STORAGE_KEY } from '../src/preview/bridge';
import { createCard, emptyState, type AppState } from '../src/shared/model';

function fixture(initial?: string) {
  const values = new Map<string, string>(); if (initial !== undefined) values.set(PREVIEW_STORAGE_KEY, initial);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
  const io = { storage, pickImport: vi.fn<() => Promise<string | null>>().mockResolvedValue(null), downloadExport: vi.fn() };
  return { values, io, bridge: createPreviewBridge(io) };
}
describe('isolated browser preview', () => {
  it('seeds only a fresh preview and restores saved edits without desktop dependencies', async () => {
    const { bridge, io } = fixture(); const loaded = await bridge.call({ type: 'load' }); expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error(loaded.error);
    const state = loaded.data as AppState; expect(state.workspaces[0].name).toBe('Build My App');
    state.workspaces[0].leftOff = 'Preview-only saved progress'; await bridge.call({ type: 'save', state });
    const restored = await createPreviewBridge(io).call({ type: 'load' });
    expect(restored.ok && (restored.data as AppState).workspaces[0].leftOff).toBe('Preview-only saved progress');
    expect(io.storage.setItem.mock.calls.every(([key]) => key === PREVIEW_STORAGE_KEY)).toBe(true);
  });
  it.each(['unreadable json', JSON.stringify({ version: 2, workspaces: [] })])('preserves unreadable or newer data', async initial => {
    const { bridge, values, io } = fixture(initial);
    const loaded = await bridge.call({ type: 'load' }); expect(loaded.ok).toBe(false);
    expect(!loaded.ok && loaded.error).toContain('preserved'); expect(values.get(PREVIEW_STORAGE_KEY)).toBe(initial); expect(io.storage.setItem).not.toHaveBeenCalled();
  });
  it('preserves the last saved state on quota failure and keeps drafts recoverable by export', async () => {
    const { bridge, io, values } = fixture(); const loaded = await bridge.call({ type: 'load' });
    if (!loaded.ok) throw new Error(loaded.error);
    const saved = values.get(PREVIEW_STORAGE_KEY), state = loaded.data as AppState;
    io.storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    state.workspaces[0].leftOff = 'New draft'; const result = await bridge.call({ type: 'save', state });
    expect(result.ok).toBe(false); expect(values.get(PREVIEW_STORAGE_KEY)).toBe(saved);
    const current = await bridge.call({ type: 'load' }); expect(current.ok && (current.data as AppState).workspaces[0].leftOff).toBe('New draft');
    await bridge.call({ type: 'export' }); expect(io.downloadExport.mock.calls[0][0]).toContain('New draft');
  });
  it('imports only after preview acceptance and remaps collisions without overwriting originals', async () => {
    const { bridge, io } = fixture(); const loaded = await bridge.call({ type: 'load' }); if (!loaded.ok) throw new Error(loaded.error);
    const initial = loaded.data as AppState;
    io.pickImport.mockResolvedValue(JSON.stringify({ format: 'focusspace', version: 1, workspaces: initial.workspaces }));
    const preview = await bridge.call({ type: 'import-preview' }); if (!preview.ok) throw new Error(preview.error);
    const before = await bridge.call({ type: 'load' }); expect(before.ok && (before.data as AppState).workspaces).toEqual(initial.workspaces);
    const accepted = await bridge.call({ type: 'import-accept', token: (preview.data as { token: string }).token });
    if (!accepted.ok) throw new Error(accepted.error);
    const state = accepted.data as AppState; expect(state.workspaces).toHaveLength(2); expect(state.workspaces[0]).toEqual(initial.workspaces[0]);
    expect(state.workspaces[1].id).not.toBe(initial.workspaces[0].id); expect(state.workspaces[1].cards[0].id).not.toBe(initial.workspaces[0].cards[0].id);
  });
  it('rejects invalid imports and never exposes credentials or reads websites', async () => {
    const { bridge, io } = fixture(); io.pickImport.mockResolvedValue('invalid file'); expect((await bridge.call({ type: 'import-preview' })).ok).toBe(false);
    expect((await bridge.call({ type: 'key', key: 'fixture-not-a-real-key' })).ok).toBe(false);
    expect(await bridge.call({ type: 'key-status' })).toEqual({ ok: true, data: { hasKey: false, available: false } });
    expect((await bridge.call({ type: 'extract' })).ok).toBe(false);
    await bridge.call({ type: 'export' }); expect(io.downloadExport.mock.calls[0][0]).not.toContain('fixture-not-a-real-key');
  });
  it('keeps failed import acceptance atomic so retry cannot duplicate projects', async () => {
    const { bridge, io } = fixture(); const loaded = await bridge.call({ type: 'load' }); if (!loaded.ok) throw new Error(loaded.error);
    io.pickImport.mockResolvedValue(JSON.stringify({ format: 'focusspace', version: 1, workspaces: (loaded.data as AppState).workspaces }));
    const preview = await bridge.call({ type: 'import-preview' }); if (!preview.ok) throw new Error(preview.error);
    io.storage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
    const command = { type: 'import-accept' as const, token: (preview.data as { token: string }).token };
    expect((await bridge.call(command)).ok).toBe(false);
    const unchanged = await bridge.call({ type: 'load' }); expect(unchanged.ok && (unchanged.data as AppState).workspaces).toHaveLength(1);
    const retry = await bridge.call(command); expect(retry.ok && (retry.data as AppState).workspaces).toHaveLength(2);
  });
  it('runs only the local demo even if a saved preference asks for a real provider', async () => {
    const { bridge } = fixture(); const loaded = await bridge.call({ type: 'load' }); if (!loaded.ok) throw new Error(loaded.error);
    const state = loaded.data as AppState; state.preferences.provider = 'openai'; await bridge.call({ type: 'save', state });
    const result = await bridge.call({ type: 'ai', requestId: 'fixture', kind: 'briefing', workspaceId: state.workspaces[0].id, content: 'Only approved fixture text' });
    expect(result.ok && (result.data as { provider: string }).provider).toBe('demo');
  });
  it('treats an intentionally empty saved preview as empty rather than reseeding', async () => {
    const { bridge, io } = fixture(JSON.stringify(emptyState())); const loaded = await bridge.call({ type: 'load' });
    expect(loaded.ok && (loaded.data as AppState).workspaces).toEqual([]); expect(io.storage.setItem).not.toHaveBeenCalled();
  });
  it('loads return values as copies and rejects invalid state before writing', async () => {
    const { bridge, io } = fixture(); const loaded = await bridge.call({ type: 'load' }); if (!loaded.ok) throw new Error(loaded.error);
    const state = loaded.data as AppState; state.workspaces[0].name = 'Unsent edit';
    const actual = await bridge.call({ type: 'load' }); expect(actual.ok && (actual.data as AppState).workspaces[0].name).toBe('Build My App');
    state.workspaces[0].cards = Array.from({ length: 201 }, (_, index) => createCard('note', `Fixture ${index}`, index));
    const writes = io.storage.setItem.mock.calls.length; expect((await bridge.call({ type: 'save', state })).ok).toBe(false); expect(io.storage.setItem).toHaveBeenCalledTimes(writes);
  });
});
