import { expect, it } from 'vitest';
import { libraryKey, readLibrary, saveLibrary } from '../src/renderer/music/library';
import { songs } from '../src/renderer/music/youtube';
it('preserves an invalid library and rejects duplicate or oversized writes', () => {
  let raw = '{broken';
  const storage = { getItem: () => raw, setItem: (key: string, value: string) => { expect(key).toBe(libraryKey); raw = value; } };
  expect(() => readLibrary(storage)).toThrow(); expect(raw).toBe('{broken');
  expect(() => saveLibrary(storage, [songs[0], songs[0]])).toThrow(); expect(raw).toBe('{broken');
  saveLibrary(storage, [songs[0]]); expect(readLibrary(storage)).toEqual([songs[0]]);
});
