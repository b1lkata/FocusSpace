import { z } from 'zod';
import type { AudiusTrack } from './audius';
import { musicStream } from './providers';

export const playlistKey = 'focusspace.playlists.v1';
export const playlistColors = ['lilac', 'rose', 'mint', 'sky', 'gold'] as const;
const link = z.string().max(2048).refine(value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } });
const track = z.object({ id: z.string().min(1).max(1000), title: z.string().min(1).max(500), user: z.object({ name: z.string().min(1).max(500) }), duration: z.number().nonnegative().optional(), artwork: z.object({ '150x150': link.optional(), '480x480': link.optional(), '1000x1000': link.optional() }).nullish(), provider: z.enum(['Audius', 'Internet Archive', 'ccMixter', 'Jamendo (Openverse)', 'Jamendo']).optional(), artistId: z.string().regex(/^\d{1,15}$/).optional(), albumId: z.string().regex(/^\d{1,15}$/).optional(), albumName: z.string().max(500).optional(), streamUrl: link.optional(), sourceUrl: link.optional(), licenseUrl: link.optional() }).refine(value => { try { musicStream(value); return true; } catch { return false; } }, 'Invalid stream');
export const playlistTrackSchema = track;
export const playlistSchema = z.object({ version: z.literal(1), lists: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), color: z.enum(playlistColors), tracks: z.array(track).max(50).refine(items => new Set(items.map(item => item.id)).size === items.length) })).max(24).refine(items => new Set(items.map(item => item.id)).size === items.length) });
export type Playlist = z.infer<typeof playlistSchema>['lists'][number];
export function readPlaylists(storage: Pick<Storage, 'getItem'>): Playlist[] {
  const raw = storage.getItem(playlistKey);
  return raw === null ? [] : playlistSchema.parse(JSON.parse(raw)).lists;
}
export function writePlaylists(storage: Pick<Storage, 'setItem'>, lists: Playlist[]) { storage.setItem(playlistKey, JSON.stringify(playlistSchema.parse({ version: 1, lists }))); }
export function playlistTrack(value: AudiusTrack) { return track.parse(value); }
