import { expect, it } from 'vitest';
import { parseLrc, currentLyric, matchedLyrics } from '../src/renderer/music/lyrics';
import { relevantTracks } from '../src/renderer/music/audius';
it('parses original timed lyrics, offsets and multiple timestamps; follows seeks', () => {
  const lines = parseLrc('[offset:200]\n[00:01.50][00:04.00]Our original line\n[00:02.00]A second original line');
  expect(lines.map(line => line.time)).toEqual([1.7, 2.2, 4.2]);
  expect(currentLyric(lines, 0)).toBe(-1); expect(currentLyric(lines, 3)).toBe(1); expect(currentLyric(lines, 1.8)).toBe(0);
  expect(parseLrc('[00:90]Invalid')).toEqual([]);
});
it('rejects wrong recordings instead of pretending lyrics are synchronized', () => {
  const record = { trackName: 'Original', artistName: 'Fixture', duration: 180, instrumental: false, syncedLyrics: '[00:01]Original line' };
  expect(matchedLyrics(record, 'Original', 'Fixture', 180).lines).toHaveLength(1);
  expect(() => matchedLyrics(record, 'Remix', 'Fixture', 180)).toThrow();
  expect(() => matchedLyrics(record, 'Original', 'Fixture', 200)).toThrow();
});
it('excludes unrelated uploads and matches artist prefixes/multiple query words', () => {
  const tracks = [{ id: 'a', title: 'Original song', user: { name: 'Ariana Grande' } }, { id: 'b', title: 'Country music', user: { name: 'Unrelated' } }, { id: 'c', title: 'Another song', user: { name: 'Stray Kids' } }];
  expect(relevantTracks(tracks, 'ariana').map(track => track.id)).toEqual(['a']);
  expect(relevantTracks(tracks, 'stray kid').map(track => track.id)).toEqual(['c']);
  expect(relevantTracks(tracks, 'chase atlantic')).toEqual([]);
  expect(relevantTracks([{ id: 'compact', title: 'Original', user: { name: 'ChaseAtlantic' } }], 'chase atlantic')).toHaveLength(1);
});
