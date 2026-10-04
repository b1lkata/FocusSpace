import { describe, expect, it } from 'vitest';
import { playlistKey, readPlaylists, writePlaylists, playlistTrack } from '../src/renderer/music/playlists';
describe('personal playlists', () => {
  it('persists validated song metadata and customizations', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const lists = [{ id: 'd17da468-7d03-4b34-8ff4-bd5e9725624d', name: 'Night drive', color: 'mint' as const, tracks: [playlistTrack({ id: 'song123', title: 'Moon', user: { name: 'Artist' } })] }];
    writePlaylists(storage, lists); expect(readPlaylists(storage)).toEqual(lists);
    expect(() => writePlaylists(storage, [{ ...lists[0], tracks: [...lists[0].tracks, ...lists[0].tracks] }])).toThrow();
    expect(readPlaylists(storage)).toEqual(lists);
  });
  it('preserves corrupt state and rejects hostile stream URLs', () => {
    const raw = '{broken'; const storage = { getItem: () => raw };
    expect(() => readPlaylists(storage)).toThrow(); expect(storage.getItem()).toBe(raw);
    expect(playlistKey).toBe('focusspace.playlists.v1');
    expect(() => playlistTrack({ id: 'archive-x', title: 'Song', user: { name: 'Artist' }, provider: 'Internet Archive', streamUrl: 'https://evil.example/song.mp3' })).toThrow();
  });
});
