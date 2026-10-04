import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { artistArtwork, identifiedArtwork } from '../src/renderer/music/artworkIdentity';
import { artworkAlternatives, trackArtwork } from '../src/renderer/music/audius';
import verified from '../src/renderer/music/verifiedArtwork.json';

it('uses confirmed artist art instead of unrelated uploader images, including stored tracks', () => {
 const track = {id:'test', title:'Ariana Grande - Unconfirmed song', user:{name:'Uploader'}, artwork:{'1000x1000':'https://wrong.example/photo.jpg'}};
 expect(trackArtwork(track)).toBe(artistArtwork('Ariana Grande'));
 expect(artworkAlternatives(track)).not.toContain('https://wrong.example/photo.jpg');
});
it('includes local artwork for every curated artist and every matched song', () => {
 expect(Object.keys(verified.artists)).toHaveLength(26);
 for (const cover of [...Object.values(verified.artists), ...Object.values(verified.songs).map(song=>song.cover)]) {
  expect(cover).toMatch(/^\.\/artwork\/[a-f0-9]+\.jpg$/);
  expect(existsSync('public/'+cover.slice(2))).toBe(true);
 }
});
it('does not invent artist identity for independent catalog tracks', () => {
 expect(identifiedArtwork({id:'indie',title:'Original song',user:{name:'Independent artist'}})).toEqual([]);
});
