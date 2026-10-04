import { afterEach, expect, it, vi } from 'vitest';
import { fetchJamendo, jamendoApiUrl, jamendoQuery, parseJamendo } from '../src/shared/jamendo';
const item = { id: '123', name: 'Étoile', artist_id: '4', artist_name: 'Independent Artist', album_id: '5', album_name: 'Night', duration: 180, audio: 'https://prod-1.storage.jamendo.com/?trackid=123&format=mp32&from=private-client', album_image: 'https://usercontent.jamendo.com/a/5.jpg', license_ccurl: 'http://creativecommons.org/licenses/by/4.0/' };
afterEach(() => vi.unstubAllGlobals());
it('keeps artist and album metadata and removes credentials from streams', () => {
  const songs = parseJamendo({ headers: { status: 'success' }, results: [item, { ...item, license_ccurl: 'https://creativecommons.org/licenses/by-nc/4.0/' }, { ...item, audio: item.audio.replace('123', '999') }] });
  expect(songs).toHaveLength(1); expect(songs[0].albumName).toBe('Night'); expect(JSON.stringify(songs)).not.toContain('private-client');
  expect(songs[0].streamUrl).toBe('https://prod-1.storage.jamendo.com/?trackid=123&format=mp32');
});
it('requests singles and album tracks, accurate search and bounded artist/album pages', () => {
  const url = jamendoApiUrl('my-client', { query: 'Night', group: 'album', offset: 24 });
  expect(url.searchParams.get('type')).toBe('single albumtrack'); expect(url.searchParams.get('groupby')).toBe('album_id'); expect(url.searchParams.get('order')).toBe('relevance');
  expect(jamendoQuery.safeParse({ offset: 2001 }).success).toBe(false); expect(jamendoQuery.safeParse({ artistId: '4', albumId: '5' }).success).toBe(false);
});
it('makes no network request without an owner client ID', async () => {
  const mock = vi.fn(); vi.stubGlobal('fetch', mock); expect(await fetchJamendo(undefined, {})).toEqual({ configured: false, tracks: [] }); expect(mock).not.toHaveBeenCalled();
});
it('reads UTF-8 across response chunks and reports upstream errors without secrets', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ headers: { status: 'success' }, results: [item] }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }))));
  expect((await fetchJamendo('my-client', {})).tracks[0].title).toBe('Étoile');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('my-client'); })); await expect(fetchJamendo('my-client', {})).rejects.toThrow('Jamendo is unavailable. Check the connection and client ID.');
});
