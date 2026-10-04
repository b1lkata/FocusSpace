import { expect, it } from 'vitest';
import { songDisplay, capitalizeSong } from '../src/renderer/music/songDisplay';
import { nativeTracks } from '../src/renderer/music/nativeAudio';
const track = (title: string, uploader = 'DJ Uploader') => ({ id: 'abc123', title, user: { name: uploader }, duration: 180 });
it('uses title artist and clean capitalized title without mutating provider metadata', () => {
 const original = track('Ariana Grande - positions (DJ Remix)');
 const before = JSON.stringify(original);
 expect(songDisplay(original)).toMatchObject({ title: 'Positions', artist: 'Ariana Grande', uploader: 'DJ Uploader', version: 'Remix', inferred: true });
 expect(JSON.stringify(original)).toBe(before);
 expect(nativeTracks([original])[0]).toMatchObject({ id: 'abc123', title: 'Positions', artist: 'Ariana Grande' });
 expect(nativeTracks([original])[0].url).toContain('/abc123/stream');
});
it('handles collaborations, accents, unknown artists and version credits', () => {
 expect(songDisplay(track('The Weeknd & Ariana Grande - save your tears (DJ Edit)'))).toMatchObject({ title: 'Save your tears', artist: 'The Weeknd & Ariana Grande', version: 'Edit' });
 expect(songDisplay(track('Beyoncé - halo (Piano Cover)'))).toMatchObject({ title: 'Halo', artist: 'Beyoncé', version: 'Cover' });
 expect(songDisplay(track('independent song (Part Two)', 'Independent Artist'))).toMatchObject({ title: 'Independent song (Part Two)', artist: 'Independent Artist', inferred: false });
 expect(songDisplay(track('Skrillex - bangarang (Zedd Remix)'))).toMatchObject({ title: 'Bangarang', artist: 'Skrillex' });
 expect(songDisplay(track('Travis Scott goosebumps ft Kendrick Lamar'))).toMatchObject({ title: 'Goosebumps', artist: 'Travis Scott & Kendrick Lamar' });
 expect(capitalizeSong('  “éclair”')).toBe('“Éclair”');
 expect(capitalizeSong('7 rings')).toBe('7 Rings');
});
