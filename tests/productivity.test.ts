import { describe, expect, it } from 'vitest';
import { addTaskDrafts, applyOrganization, undoOrganization } from '../src/shared/productivity';
import { demoWorkspace } from '../src/shared/model';
describe('organization acceptance and task drafts', () => {
  it('applies only on acceptance, returns a restorable snapshot and preserves new cards', () => {
    const w = demoWorkspace(); const original = w.cards.map(c => structuredClone(c.position));
    const result = { provider: 'demo' as const, text: 'Suggestion', tasks: [], positions: [{ cardId: w.cards[0].id, position: [15, 0, 5] as [number, number, number] }] };
    expect(w.cards.map(c => c.position)).toEqual(original); const snapshot = applyOrganization(w, result); expect(w.cards[0].position).toEqual([15, 0, 5]);
    addTaskDrafts(w, ['New task']); undoOrganization(w, snapshot); expect(w.cards.slice(0, 4).map(c => c.position)).toEqual(original); expect(w.cards).toHaveLength(5);
  });
  it('rejects unknown references atomically', () => {
    const w = demoWorkspace(); const before = structuredClone(w); expect(() => applyOrganization(w, { provider: 'demo', text: 'Suggestion', tasks: [], positions: [{ cardId: w.cards[0].id, position: [1, 0, 5] }, { cardId: 'missing', position: [2, 0, 5] }] })).toThrow(); expect(w).toEqual(before);
  });
  it('ignores blank drafts and prevents repeated/normalized duplicates', () => { const w = demoWorkspace(); expect(addTaskDrafts(w, ['Review summary', ' review SUMMARY ', ''])).toBe(1); expect(addTaskDrafts(w, ['Review summary'])).toBe(0); });
});
