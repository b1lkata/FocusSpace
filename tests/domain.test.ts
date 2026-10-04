import { describe, expect, it } from 'vitest';
import { aiResultSchema, commandSchema } from '../src/shared/bridge';
import { createCard, createWorkspace, demoWorkspace, emptyState, exportSchema, normalizeUrl, record, remapImport, stateSchema } from '../src/shared/model';
import { authorizedSender } from '../src/shared/security';

describe('URL boundary', () => {
  it('normalizes public web addresses', () => { expect(normalizeUrl('react.dev')).toBe('https://react.dev/'); expect(normalizeUrl('http://localhost:8000')).toBe('http://localhost:8000/'); });
  it.each(['javascript:alert(1)', 'file:///C:/secret', 'data:text/html,x', 'https://user:pass@example.com', '', 'not a url'])('rejects %s', value => { expect(() => normalizeUrl(value)).toThrow(); });
});
describe('project data', () => {
  it('round trips notes, tasks, layout, camera and meaningful activity', () => {
    const state = emptyState(), w = createWorkspace('Project'); state.workspaces.push(w);
    const n = createCard('note', 'Design', 0), t = createCard('task', 'Ship', 1); n.body = 'Save my context'; t.done = true; t.position = [12, 0, -3];
    w.cards.push(n, t); record(w, 'task-completed', 'Completed Ship', t.id); w.camera.position = [1, 5, 8];
    expect(stateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
  it('bounds activity without recording keystrokes', () => { const w = createWorkspace('Project'); for (let i = 0; i < 400; i++) record(w, 'website-opened', `Card ${i}`); expect(w.activity).toHaveLength(300); expect(w.activity[0].detail).toBe('Card 399'); });
  it('rejects duplicated IDs and dangling task links', () => { const state = emptyState(), w = demoWorkspace(); state.workspaces.push(w, w); expect(stateSchema.safeParse(state).success).toBe(false); const t = createCard('task', 'Task', 1); t.linkedCardId = 'missing'; w.cards.push(t); expect(stateSchema.safeParse({ ...state, workspaces: [w] }).success).toBe(false); });
});
describe('import/export', () => {
  it('remaps colliding IDs and keeps linked tasks and source references', () => {
    const w = demoWorkspace(); const website = w.cards[0]; w.cards[3].linkedCardId = website.id;
    w.summaries.push({ cardId: website.id, url: website.url!, capturedAt: '2026-10-02', text: 'Summary', provider: 'demo' });
    w.briefing = { createdAt: '2026-10-02', text: 'Next step', sourceIds: [website.id], provider: 'demo' };
    const output = remapImport({ format: 'focusspace', version: 1, workspaces: [w] })[0];
    expect(output.id).not.toBe(w.id); expect(output.cards[0].id).not.toBe(website.id);
    expect(output.cards[3].linkedCardId).toBe(output.cards[0].id); expect(output.summaries[0].cardId).toBe(output.cards[0].id); expect(output.briefing!.sourceIds).toEqual([output.cards[0].id]);
  });
  it('rejects secrets, unknown versions and unsupported URLs', () => {
    expect(exportSchema.safeParse({ format: 'focusspace', version: 1, workspaces: [], apiKey: 'secret' }).success).toBe(false);
    expect(exportSchema.safeParse({ format: 'focusspace', version: 2, workspaces: [] }).success).toBe(false);
    const w = demoWorkspace(); w.cards[0].url = 'file:///secret'; expect(exportSchema.safeParse({ format: 'focusspace', version: 1, workspaces: [w] }).success).toBe(false);
  });
});
describe('IPC and AI validation', () => {
  it('requires the trusted main frame, contents and exact app URL', () => {
    expect(authorizedSender(1, 1, 'file:///app', 'file:///app', true)).toBe(true);
    expect(authorizedSender(2, 1, 'file:///app', 'file:///app', true)).toBe(false);
    expect(authorizedSender(1, 1, 'https://website', 'file:///app', true)).toBe(false);
    expect(authorizedSender(1, 1, 'file:///app', 'file:///app', false)).toBe(false);
  });
  it('rejects extra IPC arguments and unbounded browser geometry', () => { expect(commandSchema.safeParse({ type: 'load', shell: 'evil' }).success).toBe(false); expect(commandSchema.safeParse({ type: 'bounds', rect: { x: -1, y: 0, width: 1, height: 1 } }).success).toBe(false); });
  it('rejects malformed model actions', () => { expect(aiResultSchema.safeParse({ text: 'Ok', tasks: [''], positions: [] }).success).toBe(false); expect(aiResultSchema.safeParse({ text: 'Ok', tasks: [], positions: [{ cardId: 'a', position: [Infinity, 0, 0] }] }).success).toBe(false); expect(aiResultSchema.safeParse({ text: 'Ok', tasks: [], positions: [], command: 'shell' }).success).toBe(false); });
});
