import { expect, it } from 'vitest';
import { readCollectionCache, readPreloadedCollections, saveCollectionCache, collectionCacheLifetime } from '../src/renderer/music/collectionCache';
import preloaded from '../src/renderer/music/preloadedCollections.json';
const collection = { artist: 'Fixture', tracks: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, title: `Fixture - Song ${i}`, user: { name: 'Fixture' }, duration: 180 })) };
it('loads real checked bootstrap collections and refuses future or expired bootstrap metadata', () => {
 expect(readPreloadedCollections(preloaded.savedAt + 1).length).toBeGreaterThan(0);
 expect(readPreloadedCollections(preloaded.savedAt + 86_400_001)).toEqual([]);
 expect(readPreloadedCollections(preloaded.savedAt - 1)).toEqual([]);
});
it('restores recently verified collections, expires old or future snapshots and has no ten-collection cap', () => {
 let raw: string | null = null;
 const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
 const values = Array.from({ length: 20 }, (_, index) => ({ ...collection, artist: `Fixture ${index}`, tracks: collection.tracks.map(track => ({ ...track, title: `${track.title} Fixture ${index}`, user: { name: `Fixture ${index}` } })) }));
 saveCollectionCache(storage, values, 1000);
 expect(readCollectionCache(storage, 1001).collections).toHaveLength(20);
 expect(readCollectionCache(storage, 1000 + collectionCacheLifetime).collections).toHaveLength(20);
 expect(readCollectionCache(storage, 1000 + collectionCacheLifetime).fresh).toBe(false);
 expect(readCollectionCache(storage, 1000 + 86_400_000).collections).toHaveLength(0);
 expect(readCollectionCache(storage, 999).collections).toHaveLength(0);
});
it('preserves corrupt cache data and rejects unsafe URLs and sparse collections', () => {
 const raw = '{broken'; expect(readCollectionCache({ getItem: () => raw })).toEqual({ collections: [], blocked: true, fresh: false }); expect(raw).toBe('{broken');
 expect(() => saveCollectionCache({ setItem: () => {} }, [{ ...collection, cover: 'http://unsafe.example/a' }])).toThrow();
 const data = JSON.stringify({ version: 1, savedAt: 1000, collections: [{ ...collection, tracks: collection.tracks.slice(0, 4) }] });
 expect(readCollectionCache({ getItem: () => data }, 1001).collections).toEqual([]);
});

it('caches completed empty discovery without repeating an empty scan', () => {
 let raw = ''; saveCollectionCache({ setItem: (_key, value) => { raw = value; } }, [], 1000);
 expect(readCollectionCache({ getItem: () => raw }, 1001)).toEqual({ collections: [], blocked: false, fresh: true });
});
