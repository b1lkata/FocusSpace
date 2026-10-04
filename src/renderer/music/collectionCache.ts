import preloaded from './preloadedCollections.json';
import { isPublicDemo } from '../runtime';
import { demoCollections } from './demoCatalog';
import { z } from 'zod';
import { playlistTrackSchema } from './playlists';
import type { AudiusTrack } from './audius';
import { collectionSongs, minimumCollectionTracks } from './artistCollections';
export type ArtistCollection = { artist: string; tracks: AudiusTrack[]; cover?: string };
export const collectionCacheKey = 'tuniko.artist-title-collections.v3';
export const collectionCacheLifetime = 300_000;
const maximumCacheAge = 86_400_000;
const schema = z.object({ version: z.literal(1), savedAt: z.number().finite().nonnegative(), collections: z.array(z.object({ artist: z.string().min(1).max(500), tracks: z.array(playlistTrackSchema), cover: z.string().max(2048).url().refine(value => { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }).optional() })) });
export function readCollectionCache(storage: Pick<Storage, 'getItem'>, now = Date.now()) {
 if(isPublicDemo)return {collections:demoCollections,blocked:false,fresh:true};
 try {
  const raw = storage.getItem(collectionCacheKey);
  if (!raw) return { collections: [] as ArtistCollection[], blocked: false, fresh: false };
  if (raw.length > 4_000_000) throw new Error('Oversized cache');
  const data = schema.parse(JSON.parse(raw));
  if (data.savedAt > now || now - data.savedAt >= maximumCacheAge) return { collections: [] as ArtistCollection[], blocked: false, fresh: false };
  return { collections: data.collections.map(value => ({ ...value, tracks: collectionSongs(value.tracks, value.artist) })).filter(value => value.tracks.length >= minimumCollectionTracks(value.artist)), blocked: false, fresh: now - data.savedAt < collectionCacheLifetime };
 } catch { return { collections: [] as ArtistCollection[], blocked: true, fresh: false }; }
}
export function saveCollectionCache(storage: Pick<Storage, 'setItem'>, collections: ArtistCollection[], now = Date.now()) {
 const data = schema.parse({ version: 1, savedAt: now, collections });
 const serialized = JSON.stringify(data);
 if (serialized.length > 4_000_000) throw new Error('Collection cache exceeds storage budget');
 storage.setItem(collectionCacheKey, serialized);
}

export function readPreloadedCollections(now = Date.now()) {
 if(isPublicDemo)return demoCollections;
 try {
  const data = schema.parse(preloaded);
  // Bundled metadata was checked against real audio; revalidate it in the background.
  if (data.savedAt > now || now - data.savedAt > maximumCacheAge) return [];
  return data.collections.map(value => ({ ...value, tracks: collectionSongs(value.tracks, value.artist) })).filter(value => value.tracks.length >= minimumCollectionTracks(value.artist));
 } catch { return []; }
}
