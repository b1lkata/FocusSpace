import { expect, it } from 'vitest';
import { songColor } from '../src/renderer/music/songTheme';
import { artworkAlternatives, trackArtwork } from '../src/renderer/music/audius';
it('prioritizes original high resolution artwork with distinct fallback sources', () => {
  const track = { id: 'cover', title: 'Song', user: { name: 'Artist' }, artwork: { '1000x1000': 'https://art.example/large.jpg', '480x480': 'https://art.example/medium.jpg', '150x150': 'https://art.example/small.jpg' } };
  expect(trackArtwork(track)).toBe(track.artwork['1000x1000']);
  expect(artworkAlternatives(track)).toEqual(Object.values(track.artwork));
  expect(songColor('Artist - Song')).toBe(songColor('Artist - Song'));
  expect(songColor('Artist - Song')).toMatch(/^#[a-f0-9]{6}$/);
});
