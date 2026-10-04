import { describe, expect, it } from 'vitest';
import { parseAudius } from '../src/renderer/music/audius';
import { publicSongUrl, songCaption } from '../src/renderer/music/shareCard';
import { commandSchema } from '../src/shared/bridge';
const track = { id: 'original', title: 'Original', user: { name: 'Artist' } };
describe('public song sharing', () => {
  it('bounds card IPC and refuses renderer-supplied output paths or formats', () => {
    expect(commandSchema.safeParse({ type: 'save-song-card', format: 'story', data: 'aGVsbG8=' }).success).toBe(true);
    for (const patch of [{ path: 'C:/private' }, { format: 'exe' }, { data: 'not base64!' }, { data: 'a'.repeat(6_000_001) }]) expect(commandSchema.safeParse({ type: 'save-song-card', format: 'story', data: 'aGVsbG8=', ...patch }).success).toBe(false);
  });
  it('retains an Audius permalink without inventing one for missing metadata', () => {
    const items = parseAudius({ data: [{ ...track, permalink: '/artist/original' }] });
    expect(publicSongUrl(items[0])).toBe('https://audius.co/artist/original');
    expect(publicSongUrl(track)).toBeUndefined();
    expect(publicSongUrl(parseAudius({ data: [{ ...track, permalink: 'https://evil.test/track' }] })[0])).toBeUndefined();
  });
  it('rejects private, executable and mismatched links while retaining provider pages', () => {
    for (const sourceUrl of ['file:///private.mp3', 'blob:https://audius.co/file', 'javascript:alert(1)', 'https://audius.co.evil.test/t', 'https://name:secret@audius.co/t']) expect(publicSongUrl({ ...track, sourceUrl })).toBeUndefined();
    expect(publicSongUrl({ ...track, provider: 'Internet Archive', sourceUrl: 'https://archive.org/details/original' })).toBe('https://archive.org/details/original');
    expect(publicSongUrl({ ...track, provider: 'Jamendo (Openverse)', sourceUrl: 'https://www.jamendo.com/track/123' })).toBe('https://www.jamendo.com/track/123');
  });
  it('keeps attribution in captions and never shares a local audio URL', () => {
    expect(songCaption({ title: 'Original', artist: 'Artist', color: '#ffffff', url: 'https://archive.org/details/original', provider: 'Internet Archive', license: 'https://creativecommons.org/licenses/by/4.0/' })).toContain('License: https://creativecommons.org/licenses/by/4.0/');
    expect(songCaption({ title: 'My MP3', artist: '', color: '#ffffff' })).toBe('My MP3\nListening with Tuniko');
  });
});
