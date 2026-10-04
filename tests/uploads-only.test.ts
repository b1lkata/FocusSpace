import { expect, it } from 'vitest';
import { isCatalogUpload } from '../src/renderer/music/audius';
import { readCollectionCache, readPreloadedCollections } from '../src/renderer/music/collectionCache';
import { minimumCollectionTracks } from '../src/renderer/music/artistCollections';
import preloaded from '../src/renderer/music/preloadedCollections.json';
const track = (title: string) => ({ id: 'abc', title, duration: 180, user: { name: 'Uploader' } });
it('rejects labeled alternate recordings while retaining unmarked uploads', () => {
 for (const title of ['Song (DJ Remix)', 'Song (Edit)', 'Song Cover', 'Song Bootleg', 'Song Flip', 'Song Acoustic', 'Song Live', 'Song Mashup', 'Song Sped Up', 'Song Slowed']) expect(isCatalogUpload(track(title))).toBe(false);
 expect(isCatalogUpload(track('Song [Official Audio]'))).toBe(true);
 expect(isCatalogUpload({ ...track('Song'), provider: 'ccMixter' })).toBe(false);
});
it('ships upload collections with the requested five-song BTS exception and rejects five-song or alternate-filled cached collections', () => {
 const collections = readPreloadedCollections(preloaded.savedAt + 1);
 expect(collections).toHaveLength(26);
 expect(collections.reduce((count, collection) => count + collection.tracks.length, 0)).toBe(464);
 expect(collections.every(collection => collection.tracks.length >= minimumCollectionTracks(collection.artist) && collection.tracks.every(isCatalogUpload))).toBe(true);
 const tracks = Array.from({ length: 6 }, (_, index) => ({ ...track(`Adele - Song ${index}`), id: `t${index}` }));
 const raw = JSON.stringify({ version: 1, savedAt: 1000, collections: [{ artist: 'Adele', tracks: [...tracks.slice(0, 5), { ...tracks[5], title: 'Adele - Song (Remix)' }] }] });
 expect(readCollectionCache({ getItem: () => raw }, 1001).collections).toEqual([]);
});

it('removes Dynamite (1980) from old caches without losing BTS or other Dynamite uploads', () => {
 const bts = preloaded.collections.find(value => value.artist === 'BTS')!;
 expect(bts.tracks).toHaveLength(5);
 const removed = { ...track('BTS - Dynamite (1980)'), id: 'j445o' };
 expect(isCatalogUpload(removed)).toBe(false);
 expect(isCatalogUpload({ ...removed, title: 'Renamed upload' })).toBe(false);
 expect(isCatalogUpload(track('BTS - Dynamite'))).toBe(true);
 const raw = JSON.stringify({ version: 1, savedAt: 1000, collections: [{ ...bts, tracks: [...bts.tracks, removed] }] });
 const restored = readCollectionCache({ getItem: () => raw }, 1001).collections;
 expect(restored).toHaveLength(1);
 expect(restored[0].tracks).toHaveLength(5);
 expect(restored[0].tracks.some(value => value.id === 'j445o')).toBe(false);
});
