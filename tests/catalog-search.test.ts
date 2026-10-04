import { matchesCatalog } from '../src/renderer/music/audioFiles';
import { expect, it } from 'vitest';
import { catalogUrl, parseCatalog } from '../src/renderer/music/catalogSearch';
it('bounds search and excludes untrusted catalog links, duplicates and invalid tracks', () => {
  expect(new URL(catalogUrl('artist & song')).searchParams.get('term')).toBe('artist & song');
  expect(new URL(catalogUrl('a'.repeat(500))).searchParams.get('term')).toHaveLength(200);
  const item = { trackId: 1, trackName: 'A song', artistName: 'Artist', trackViewUrl: 'https://music.apple.com/us/album/test/123' };
  expect(parseCatalog({ results: [item, item, { ...item, trackId: 2, trackViewUrl: 'https://music.apple.com.evil.test/a' }, { ...item, trackId: 3, trackViewUrl: 'javascript:alert(1)' }, { trackId: 4 }] })).toEqual([item]);
  expect(() => parseCatalog({ results: 'broken' })).toThrow();
});

it('links catalog tracks to imported audio without fuzzy wrong-song matches', () => {
  const track = { trackId: 99, trackName: 'Stay', artistName: 'Artist', trackViewUrl: 'https://music.apple.com/us/album/test/99' };
  const file = { id: 'one', name: 'Artist - Stay', blob: new Blob(['fixture']) };
  expect(matchesCatalog(file, track)).toBe(true);
  expect(matchesCatalog({ ...file, name: 'Stay With Me' }, track)).toBe(false);
  expect(matchesCatalog({ ...file, name: 'Different', catalogId: 99 }, track)).toBe(true);
});
