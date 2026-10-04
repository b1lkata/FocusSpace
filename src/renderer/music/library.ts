import { z } from 'zod';
import type { Song } from './youtube';

export const libraryKey = 'focusspace.library.v1';
const schema = z.array(z.object({ id: z.string().regex(/^[\w-]{11}$/), title: z.string().min(1).max(200), artist: z.string().min(1).max(200), artistId: z.string().max(40), mood: z.string().max(40) }).strict()).max(500).refine(items => new Set(items.map(item => item.id)).size === items.length);
export function readLibrary(storage: Pick<Storage, 'getItem'>): Song[] {
  const raw = storage.getItem(libraryKey);
  return raw === null ? [] : schema.parse(JSON.parse(raw));
}
export function saveLibrary(storage: Pick<Storage, 'setItem'>, songs: Song[]) {
  storage.setItem(libraryKey, JSON.stringify(schema.parse(songs)));
}
