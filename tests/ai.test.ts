import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('electron', () => ({ safeStorage: {} }));
import { demoResult, openAIResult } from '../src/main/ai';
import { demoWorkspace } from '../src/shared/model';
describe('demo assistant', () => {
  it('labels its provider and uses recorded context', () => { const w = demoWorkspace(); const result = demoResult('briefing', w, ''); expect(result.provider).toBe('demo'); expect(result.text).toContain(w.leftOff); expect(result.text).toContain(w.cards[3].title); expect(result.text).toContain('suggested next step'); });
  it('previews a layout without mutating cards and permits restoration', () => { const w = demoWorkspace(); const original = structuredClone(w.cards); const result = demoResult('organize', w, ''); expect(w.cards).toEqual(original); for (const p of result.positions) w.cards.find(c => c.id === p.cardId)!.position = p.position; expect(w.cards.map(c => c.position)).not.toEqual(original.map(c => c.position)); original.forEach(c => { w.cards.find(x => x.id === c.id)!.position = c.position; }); expect(w.cards).toEqual(original); });
});
describe('OpenAI provider with deterministic HTTP fixtures', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses Responses structured output with no tools and no server storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ text: 'Recorded facts and a suggestion', tasks: [], positions: [] }) }] }] }) }); vi.stubGlobal('fetch', fetchMock);
    const result = await openAIResult('briefing', demoWorkspace(), 'approved content', 'configured-model', 'fake-key', new AbortController().signal);
    expect(result.provider).toBe('openai'); const body = JSON.parse(fetchMock.mock.calls[0][1].body); expect(body.store).toBe(false); expect(body.model).toBe('configured-model'); expect(body.tools).toBeUndefined(); expect(body.instructions).toContain('untrusted data'); expect(body.text.format.type).toBe('json_schema');
  });
  it.each([[401, 'API key'], [429, 'limit'], [500, 'failed']])('reports HTTP %s safely', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status })); await expect(openAIResult('briefing', demoWorkspace(), 'approved', 'model', 'fake-key', new AbortController().signal)).rejects.toThrow(String(message));
  });
  it('rejects fabricated organization references before returning actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ text: 'Group cards', tasks: [], positions: [{ cardId: 'fabricated', position: [1, 0, 0] }] }) }] }] }) }));
    await expect(openAIResult('organize', demoWorkspace(), 'approved', 'model', 'fake-key', new AbortController().signal)).rejects.toThrow('invalid card references');
  });
});
