import { z } from 'zod';
const track = z.object({ trackId: z.number().int().positive(), trackName: z.string().min(1).max(500), artistName: z.string().min(1).max(500), collectionName: z.string().max(500).optional(), trackViewUrl: z.string().url(), trackTimeMillis: z.number().nonnegative().optional() });
export type CatalogTrack = z.infer<typeof track>;
export function catalogUrl(term: string) {
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({ term: term.trim().slice(0, 200), entity: 'song', media: 'music', limit: '100', country: 'US' }).toString();
  return url.href;
}
export function parseCatalog(value: unknown): CatalogTrack[] {
  const raw = z.object({ results: z.array(z.unknown()).max(200) }).parse(value);
  const seen = new Set<number>();
  return raw.results.flatMap(value => {
    const parsed = track.safeParse(value); if (!parsed.success) return [];
    const item = parsed.data; const url = new URL(item.trackViewUrl);
    if (url.protocol !== 'https:' || !['music.apple.com', 'itunes.apple.com'].includes(url.hostname) || url.username || url.password || seen.has(item.trackId)) return [];
    seen.add(item.trackId); return [item];
  });
}
