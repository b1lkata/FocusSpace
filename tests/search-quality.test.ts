import { afterEach, expect, it, vi } from 'vitest';
import albums from '../src/renderer/music/featuredAlbums.json';
import { closeSearchWord, correctedSearch } from '../src/renderer/music/searchText';
import { relevantTracks } from '../src/renderer/music/audius';
import { playableTracks } from '../src/renderer/music/streamAvailability';
afterEach(() => vi.unstubAllGlobals());
it('keeps ten official album identities and their associated track lists', () => {
  expect(albums).toHaveLength(10);
  expect(albums.map(album => album.artist)).toEqual(expect.arrayContaining(['The Weeknd', 'Ariana Grande', 'Shawn Mendes', 'Adele']));
  for (const album of albums) { expect(album.source).toMatch(/^https:\/\/music.apple.com\//); expect(album.cover).toContain('600x600'); expect(album.tracks.length).toBeGreaterThan(5); expect(album.tracks.every(track => track.artist === album.artist)).toBe(true); }
});
it('corrects small title/artist typos including swapped letters, preserves exact input and avoids short-word guesses', () => {
  expect(correctedSearch('the weknd')).toBe('The Weeknd');
  expect(correctedSearch('ariana grnade')).toBe('Ariana Grande');
  expect(correctedSearch('blinding ligths')).toBe('Blinding Lights');
  expect(correctedSearch('Moonlight')).toBe('Moonlight');
  expect(closeSearchWord('sun', 'son')).toBe(false);
  expect(relevantTracks([{ id: 'one', title: 'Blinding Lights', user: { name: 'The Weeknd' } }, { id: 'two', title: 'Different music', user: { name: 'Other' } }], 'blinding ligths').map(track => track.id)).toEqual(['one']);
});
it('excludes actual short streams even with overstated metadata, unknown duration and metadata below sixty', async () => {
  class FakeAudio {
    src = ''; preload = ''; muted = false; duration = 65; oncanplay: (() => void) | null = null; onerror: (() => void) | null = null;
    load() { if (this.src) { this.duration = this.src.includes('shortActual') ? 3 : this.src.includes('unknownActual') ? NaN : 65; queueMicrotask(() => this.oncanplay?.()); } }
    pause() { /* No playback during validation. */ }
    removeAttribute() { this.src = ''; }
  }
  vi.stubGlobal('Audio', FakeAudio); vi.stubGlobal('window', new EventTarget());
  const tracks = [{ id: 'shortActual', duration: 180 }, { id: 'unknownActual' }, { id: 'shortMetadata', duration: 59 }, { id: 'fullLength', duration: 60 }, { id: 'measuredLength' }].map(track => ({ ...track, title: track.id, user: { name: 'Fixture' } }));
  expect((await playableTracks(tracks, new AbortController().signal)).map(track => track.id)).toEqual(['fullLength', 'measuredLength']);
});
