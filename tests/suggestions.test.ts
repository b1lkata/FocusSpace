import { expect, it } from 'vitest';
import { shuffledSuggestions } from '../src/renderer/music/suggestions';
it('reshuffles all eligible suggestions without modifying the source or repeating its order', () => {
 const source = Array.from({ length: 24 }, (_, id) => ({ id }));
 const original = [...source];
 for (const random of [() => 0, () => 0.999]) {
  const shuffled = shuffledSuggestions(source, random);
  expect(new Set(shuffled)).toEqual(new Set(source));
  expect(shuffled).not.toEqual(source);
 }
 expect(source).toEqual(original);
 expect(shuffledSuggestions([])).toEqual([]);
 expect(shuffledSuggestions([1])).toEqual([1]);
});
