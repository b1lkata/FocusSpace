import { expect, it } from 'vitest';
import { artistSongs, shortSongName, collectionSongs, collectionSongName, titleMentionsArtist, shuffledArtists, featuredArtists } from '../src/renderer/music/artistCollections';
it('uses exact artist identity, full songs, distinct titles and excludes alternate recordings', () => {
 const tracks = ['Original', 'Original', 'Other cover', 'Tiny', 'Wrong'].map((title, index) => ({ id: String(index), title, duration: title === 'Tiny' ? 30 : 180, user: { name: title === 'Wrong' ? 'Different artist' : 'Adele' } }));
 expect(artistSongs(tracks, 'Adele').map(track => track.title)).toEqual(['Original']);
});
it('shortens promotional suffixes without changing the stored title or removing meaningful parentheses', () => {
 expect(shortSongName('Song (feat. Guest) - Official Audio')).toBe('Song');
 expect(shortSongName('Song [Official Video]')).toBe('Song');
 expect(shortSongName('Song (Part Two)')).toBe('Song (Part Two)');
});

it('groups title mentions independently of uploader and rejects unrelated short or artificial matches', () => {
 const make = (title: string, duration = 180) => ({ id: title.replace(/[^a-z]/gi, ''), title, duration, user: { name: 'Uploader' } });
 expect(collectionSongs([make('Ariana Grande - positions [Official Audio]'), make('positions'), make('THE WEEKND ARIANA GRANDE'), make('Ariana Grande Type Beat'), make('Ariana Grande - short', 20)], 'Ariana Grande')).toHaveLength(1);
 expect(titleMentionsArtist('Beyonc\u00e9 - Halo', 'Beyonce')).toBe(true);
 expect(titleMentionsArtist('dubstep release', 'BTS')).toBe(false);
 expect(collectionSongName('Ariana Grande - positions (DJ Remix)', 'Ariana Grande')).toBe('positions');
 expect(collectionSongName('Ariana Grande - Santa Tell Me - Cover (Violin)', 'Ariana Grande')).toBe('Santa Tell Me');
 expect(collectionSongName('Hello - Adele (Violin Cover)', 'Adele')).toBe('Hello');
 expect(collectionSongName('The Weeknd - Save Your Tears [Official Audio]', 'The Weeknd')).toBe('Save Your Tears');
 expect(collectionSongName('Calvin Harris ft. Dua Lipa - One Kiss (DJ Remix)', 'Dua Lipa')).toBe('One Kiss');
 expect(collectionSongName('Beyonc\u00e9 - Halo (DJ Remix)', 'Beyonce')).toBe('Halo');
 expect(collectionSongName('Coldplay - Song (Part Two)', 'Coldplay')).toBe('Song (Part Two)');
});
it('shuffles every chosen artist once without modifying the artist list', () => {
 const order = shuffledArtists(() => 0);
 expect(new Set(order)).toEqual(new Set(featuredArtists));
 expect(order).not.toEqual(featuredArtists);
 expect(shuffledArtists(() => 0.999)).toEqual(featuredArtists);
});
