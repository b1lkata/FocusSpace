import { z } from 'zod';
export const jamendoQuery = z.object({ query: z.string().max(200).default(''), discover: z.boolean().default(false), offset: z.number().int().min(0).max(2000).default(0), artistId: z.string().regex(/^\d{1,15}$/).optional(), albumId: z.string().regex(/^\d{1,15}$/).optional(), group: z.enum(['artist', 'album']).optional() }).strict().refine(value => !(value.artistId && value.albumId));
export type JamendoQuery = z.input<typeof jamendoQuery>;
export const jamendoClientId = z.string().regex(/^[a-zA-Z0-9_-]{4,128}$/);
const numeric = z.string().regex(/^\d{1,15}$/);
export const jamendoResult = z.object({ configured: z.boolean(), tracks: z.array(z.object({ id: z.string().regex(/^jm:\d{1,15}$/), title: z.string().min(1).max(500), user: z.object({ name: z.string().min(1).max(500) }), provider: z.literal('Jamendo'), artistId: numeric, albumId: numeric.optional(), albumName: z.string().max(500).optional(), duration: z.number().nonnegative(), streamUrl: z.string().max(2048).regex(/^https:\/\/prod-1\.storage\.jamendo\.com\/\?trackid=\d{1,15}&format=mp3[12]$/), sourceUrl: z.string().max(2048).regex(/^https:\/\/www\.jamendo\.com\/track\/\d{1,15}$/), licenseUrl: z.string().max(2048).regex(/^https:\/\/creativecommons\.org\/(licenses\/(by|by-sa)\/(1\.0|2\.0|2\.5|3\.0|4\.0)|publicdomain\/(zero|mark)\/1\.0)\/?$/), artwork: z.object({ '480x480': z.string().max(2048).refine(value => !!cover(value)) }).optional() })).max(24) });
const itemSchema = z.object({ id: numeric, name: z.string().min(1).max(500), artist_id: numeric, artist_name: z.string().min(1).max(500), album_id: z.string().max(15).optional(), album_name: z.string().max(500).optional(), duration: z.number().nonnegative(), audio: z.string().max(2048), image: z.string().max(2048).optional(), album_image: z.string().max(2048).optional(), license_ccurl: z.string().max(2048) });
function cover(value?: string) { try { const url = new URL(value ?? ''); return url.protocol === 'https:' && ['usercontent.jamendo.com', 'images.jamendo.com'].includes(url.hostname) && !url.username && !url.password && !url.port && ![...url.searchParams.keys()].some(key => /client|token|secret|key/i.test(key)) ? url.href : undefined; } catch { return; } }
export function parseJamendo(value: unknown) {
  const envelope = z.object({ headers: z.object({ status: z.literal('success') }), results: z.array(z.unknown()).max(200) }).parse(value);
  return envelope.results.flatMap(raw => {
    const parsed = itemSchema.safeParse(raw); if (!parsed.success) return [];
    const item = parsed.data;
    try {
      const audio = new URL(item.audio), license = new URL(item.license_ccurl);
      if (audio.protocol !== 'https:' || audio.hostname !== 'prod-1.storage.jamendo.com' || audio.pathname !== '/' || audio.username || audio.password || audio.port || audio.searchParams.get('trackid') !== item.id || !['mp31', 'mp32'].includes(audio.searchParams.get('format') ?? '')) return [];
      if (!['http:', 'https:'].includes(license.protocol) || license.hostname !== 'creativecommons.org' || license.username || license.password || license.port || license.search || license.hash || !/^\/(licenses\/(by|by-sa)\/(1\.0|2\.0|2\.5|3\.0|4\.0)|publicdomain\/(zero|mark)\/1\.0)\/?$/.test(license.pathname)) return [];
      license.protocol = 'https:';
      const stream = new URL('https://prod-1.storage.jamendo.com/'); stream.searchParams.set('trackid', item.id); stream.searchParams.set('format', audio.searchParams.get('format')!);
      const image = cover(item.album_image) ?? cover(item.image);
      return [{ id: `jm:${item.id}`, title: item.name, user: { name: item.artist_name }, provider: 'Jamendo' as const, artistId: item.artist_id, ...(item.album_id && /^\d{1,15}$/.test(item.album_id) ? { albumId: item.album_id } : {}), ...(item.album_name ? { albumName: item.album_name } : {}), duration: item.duration, streamUrl: stream.href, sourceUrl: `https://www.jamendo.com/track/${item.id}`, licenseUrl: license.href, ...(image ? { artwork: { '480x480': image } } : {}) }];
    } catch { return []; }
  });
}
export function jamendoApiUrl(client: string, raw: JamendoQuery) {
  const options = jamendoQuery.parse(raw), url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.search = new URLSearchParams({ client_id: jamendoClientId.parse(client), format: 'json', limit: '24', offset: String(options.offset), type: 'single albumtrack', audioformat: 'mp32', imagesize: '600', ccnc: 'false', ccnd: 'false', order: options.discover ? 'popularity_month' : 'relevance' }).toString();
  if (options.query && !options.discover) url.searchParams.set('search', options.query);
  if (options.artistId) url.searchParams.set('artist_id', options.artistId);
  if (options.albumId) url.searchParams.set('album_id', options.albumId);
  if (options.group) url.searchParams.set('groupby', `${options.group}_id`);
  return url;
}
export async function fetchJamendo(client: string | undefined, options: JamendoQuery) {
  jamendoQuery.parse(options);
  if (!client) return { configured: false, tracks: [] };
  try {
    const response = await fetch(jamendoApiUrl(client, options), { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw new Error();
    let text = ''; const decoder = new TextDecoder(); const reader = response.body?.getReader(); if (!reader) throw new Error();
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; text += decoder.decode(value, { stream: true }); if (text.length > 2_000_000) { await reader.cancel(); throw new Error(); } } } finally { reader.releaseLock(); }
    text += decoder.decode();
    return { configured: true, tracks: parseJamendo(JSON.parse(text)) };
  } catch { throw new Error('Jamendo is unavailable. Check the connection and client ID.'); }
}
