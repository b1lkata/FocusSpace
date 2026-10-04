import { describe, expect, it, vi, afterEach } from 'vitest';
import { freeLicense, parseArchive, parseMixter, musicStream, searchMusic, parseOpenverse } from '../src/renderer/music/providers';
const metadata = { title: 'Album', creator: 'Example', licenseurl: 'http://creativecommons.org/licenses/by/4.0/' };
describe('Free music providers', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('accepts explicit reusable licenses and rejects spoofed/unknown/NC licenses', () => {
    expect(freeLicense(metadata.licenseurl)).toBe('https://creativecommons.org/licenses/by/4.0/');
    for (const url of ['https://creativecommons.org.evil/licenses/by/4.0/', 'https://creativecommons.org/licenses/by-nc/4.0/', 'all rights reserved', 'https://user@creativecommons.org/licenses/by/4.0/']) expect(freeLicense(url)).toBeUndefined();
  });
  it('exposes actual MP3 files, album art/credit, and rejects restricted/path traversal entries', () => {
    const songs = parseArchive({ metadata, files: [{ name: 'song one.mp3', title: 'Song One', length: '180' }, { name: '../evil.mp3' }, { name: 'cover.jpg' }, { name: 'private.mp3', private: true }] }, 'album-id');
    expect(songs).toHaveLength(1); expect(songs[0].title).toBe('Song One'); expect(songs[0].duration).toBe(180); expect(musicStream(songs[0])).toBe('https://archive.org/download/album-id/song%20one.mp3');
    expect(parseArchive({ metadata: { ...metadata, access_restricted: true }, files: [{ name: 'song.mp3' }] }, 'album')).toEqual([]);
  });
  it('accepts licensed ccMixter MP3s and rejects foreign stream hosts', () => {
    const item = { upload_id: 123, upload_name: 'Song', user_name: 'Singer', license_url: metadata.licenseurl, file_page_url: 'https://ccmixter.org/files/singer/123', files: [{ download_url: 'https://ccmixter.org/content/singer/song.mp3', file_name: 'song.mp3' }] };
    const songs = parseMixter([item]); expect(songs).toHaveLength(1); expect(musicStream(songs[0])).toContain('/content/');
    expect(parseMixter([{ ...item, files: [{ download_url: 'https://evil.example/song.mp3', file_name: 'song.mp3' }] }])).toEqual([]);
    expect(() => musicStream({ ...songs[0], streamUrl: 'https://evil.example/song.mp3' })).toThrow();
  });
  it('retains successful sources when another provider fails', async () => {
    vi.stubGlobal('window', { focusspace: { call: vi.fn().mockResolvedValue({ ok: false, error: 'Offline' }) } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('api.audius.co')) return { ok: true, json: async () => ({ data: [{ id: 'one', title: 'Song', user: { name: 'Artist' } }] }) };
      throw new Error('Offline');
    }));
    const result = await searchMusic('Song', false, new AbortController().signal); expect(result.tracks).toHaveLength(1); expect(result.failed).toEqual(['Internet Archive', 'ccMixter', 'Jamendo (Openverse)', 'Jamendo']);
  });
  it('imports licensed Jamendo music via Openverse, converts duration, and rejects unsafe/nonmusic entries', () => {
    const item = { id: '12345678-1234-4234-8234-123456789012', title: 'Song', creator: 'Artist', url: 'https://prod-1.storage.jamendo.com/?trackid=42&format=mp32', foreign_landing_url: 'https://www.jamendo.com/track/42', license_url: metadata.licenseurl, source: 'jamendo', category: 'music', duration: 183000 };
    const tracks = parseOpenverse({ results: [item] }); expect(tracks).toHaveLength(1); expect(tracks[0].duration).toBe(183); expect(musicStream(tracks[0])).toBe(item.url);
    for (const override of [{ category: 'sound_effect' }, { license_url: 'https://creativecommons.org/licenses/by-nc/4.0/' }, { url: 'https://evil.example/?trackid=42&format=mp32' }, { foreign_landing_url: 'https://www.jamendo.com/track/43' }, { mature: true }]) expect(parseOpenverse({ results: [{ ...item, ...override }] })).toEqual([]);
  });

});
