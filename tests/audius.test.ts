import { expect, it } from 'vitest';
import { audiusStream, audiusUrl, parseAudius, rankAudius, trackArtwork } from '../src/renderer/music/audius';
it('uses only official read/stream routes and filters unavailable or gated tracks', () => {
  const track = { id: 'D7KyD', title: 'A song', user: { name: 'Artist' } };
  expect(parseAudius({ data: [track, track, { ...track, id: 'other', is_stream_gated: true }, { ...track, id: 'third', access: { stream: false } }, { ...track, id: '../unsafe' }, { ...track, id: 'deleted', is_delete: true }] })).toEqual([track]);
  expect(() => audiusStream('../unsafe')).toThrow(); expect(audiusStream(track.id)).toBe('https://api.audius.co/v1/tracks/D7KyD/stream?app_name=FocusSpace');
  expect(new URL(audiusUrl('artist & song')).searchParams.get('query')).toBe('artist & song'); expect(new URL(audiusUrl('ignored', true)).pathname).toBe('/v1/tracks/trending');
});
it('keeps playable songs when artwork is missing or unsafe and accepts only HTTPS artwork', () => {
  const track = { id: 'art', title: 'Song', user: { name: 'Artist' } };
  const tracks = parseAudius({ data: [{ ...track, artwork: { '480x480': 'https://images.example/album.jpg' } }, { ...track, id: 'unsafe', artwork: { '480x480': 'javascript:alert(1)' } }, { ...track, id: 'missing', artwork: null }] });
  expect(tracks).toHaveLength(3); expect(trackArtwork(tracks[0])).toBe('https://images.example/album.jpg'); expect(trackArtwork(tracks[1])).toBeUndefined();
});
it('puts exact title matches before broad mixes and recognizes artist plus song queries', () => {
  const make = (id: string, title: string, name: string) => ({ id, title, user: { name } });
  const tracks = [make('mix', 'Night Drive remix', 'DJ'), make('broad', 'Drive megamix', 'Elsewhere'), make('exact', 'Night Drive', 'Example Artist')];
  expect(rankAudius(tracks, 'Night Drive').map(t => t.id)).toEqual(['exact', 'mix', 'broad']);
  expect(rankAudius(tracks, 'Example Artist Night Drive')[0].id).toBe('exact');
  expect(rankAudius(tracks, '')).toEqual(tracks);
});
it('prefers familiar artists within matching songs without overriding exact titles or requested remixes', () => {
  const tracks = [{ id: 'other', title: 'Moonlight', user: { name: 'Independent artist' } }, { id: 'known', title: 'Moonlight', user: { name: 'Ariana Grande' } }, { id: 'cover', title: 'Moonlight cover', user: { name: 'Ariana Grande' } }, { id: 'broad', title: 'Moonlight collection', user: { name: 'The Weeknd' } }];
  expect(rankAudius(tracks, 'Moonlight').map(track => track.id)).toEqual(['known', 'other', 'broad', 'cover']);
  expect(rankAudius(tracks, 'Moonlight cover')[0].id).toBe('cover');
});
