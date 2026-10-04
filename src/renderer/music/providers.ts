import { isCatalogUpload } from './audius';
import { correctedSearch, normalizeSearch } from './searchText';
import { directJamendo } from './jamendoClient';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { isWebPreview, isMobileBuild } from '../runtime';
import { isPublicDemo } from '../runtime';
import { demoTracks, demoStream } from './demoCatalog';
import { z } from 'zod';
import { audiusStream, audiusUrl, parseAudius, relevantTracks, type AudiusTrack } from './audius';

export function jamendoStream(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'prod-1.storage.jamendo.com' || url.pathname !== '/' || !/^\d{1,15}$/.test(url.searchParams.get('trackid') ?? '') || !['mp31', 'mp32'].includes(url.searchParams.get('format') ?? '') || url.username || url.password || url.port || url.hash || [...url.searchParams.keys()].some(key => !['trackid', 'format'].includes(key))) throw new Error('Invalid music source');
  return url.href;
}
export function musicStream(track: AudiusTrack) {
  if(isPublicDemo)return demoStream(track.id);
  if ((track.provider === 'Jamendo (Openverse)' || track.provider === 'Jamendo')) return jamendoStream(track.streamUrl ?? '');
  if (track.provider === 'Internet Archive' || track.provider === 'ccMixter') {
    const url = new URL(track.streamUrl ?? '');
    if (url.protocol !== 'https:' || !(track.provider === 'Internet Archive' ? url.hostname === 'archive.org' && url.pathname.startsWith('/download/') : url.hostname === 'ccmixter.org' && url.pathname.startsWith('/content/') && /\.mp3$/i.test(url.pathname)) || url.username || url.password || url.port || url.hash) throw new Error('Invalid music source');
    return url.href;
  }
  return audiusStream(track.id);
}
export const musicProvider = (track: AudiusTrack) => isPublicDemo ? 'Tuniko demo' : track.provider ?? 'Audius';
export function freeLicense(value: unknown): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== 'string') return;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'creativecommons.org' || url.username || url.password || url.port || url.search || url.hash) return;
    if (!/^\/(licenses\/(by|by-sa)\/(1\.0|2\.0|2\.5|3\.0|4\.0)|publicdomain\/(zero|mark)\/1\.0)\/?$/.test(url.pathname)) return;
    url.protocol = 'https:'; return url.href;
  } catch { return; }
}
const textField = z.union([z.string(), z.array(z.string())]).optional().transform(value => Array.isArray(value) ? value.join(', ') : value);
const archiveItem = z.object({ metadata: z.object({ title: textField, creator: textField, licenseurl: z.unknown(), access_restricted: z.unknown().optional() }), files: z.array(z.object({ name: z.string().max(1000), title: textField, format: z.string().optional(), length: z.union([z.string(), z.number()]).optional(), private: z.unknown().optional() })).max(5000) });
export function parseArchive(value: unknown, identifier: string): AudiusTrack[] {
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(identifier)) return [];
  const result = archiveItem.safeParse(value); if (!result.success) return [];
  const { metadata, files } = result.data; const license = freeLicense(metadata.licenseurl);
  if (!license || (metadata.access_restricted != null && metadata.access_restricted !== false && metadata.access_restricted !== 'false')) return [];
  const sourceUrl = `https://archive.org/details/${encodeURIComponent(identifier)}`;
  const selected = files.filter(file => /\.mp3$/i.test(file.name) && !file.private && !file.name.split('/').some(part => part === '..' || part === '.') && !file.name.includes('\\')).slice(0, 20);
  return selected.map((file, index) => {
    const duration = Number(file.length);
    return { id: `ia:${identifier}:${index}`, provider: 'Internet Archive', title: (file.title || (selected.length === 1 ? metadata.title : file.name.replace(/\.mp3$/i, '')) || 'Untitled').slice(0, 500), user: { name: (metadata.creator || 'Creator not listed').slice(0, 500) }, duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      streamUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${file.name.split('/').map(encodeURIComponent).join('/')}`, sourceUrl, licenseUrl: license, artwork: { '480x480': `https://archive.org/services/img/${encodeURIComponent(identifier)}` } };
  });
}
async function json(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), credentials: 'omit' });
  if (!response.ok) throw new Error('Provider unavailable'); return response.json() as Promise<unknown>;
}
export async function archiveSearch(query: string, trending: boolean, signal: AbortSignal) {
  const terms = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 12);
  const base = 'mediatype:audio AND (collection:netlabels OR subject:music) AND licenseurl:* AND NOT licenseurl:(*by-nc* OR *by-nd*) AND format:(*MP3*)';
  const match = terms.map(term => `(title:"${term}" OR creator:"${term}" OR subject:"${term}")`).join(' AND ');
  const url = new URL('https://archive.org/advancedsearch.php'); url.searchParams.set('q', base + (!trending && match ? ` AND (${match})` : '')); url.searchParams.set('output', 'json'); url.searchParams.set('rows', '8'); url.searchParams.append('fl[]', 'identifier');
  if (trending) url.searchParams.append('sort[]', 'downloads desc');
  const result = z.object({ response: z.object({ docs: z.array(z.object({ identifier: z.string() })).max(100) }) }).parse(await json(url.href, signal));
  const settled = await Promise.allSettled(result.response.docs.map(async item => parseArchive(await json(`https://archive.org/metadata/${encodeURIComponent(item.identifier)}`, signal), item.identifier)));
  if (signal.aborted) throw new Error('Search cancelled');
  const groups = settled.map(value => value.status === 'fulfilled' ? value.value : []);
  const songs = Array.from({ length: Math.max(...groups.map(group => group.length), 0) }, (_, index) => groups.flatMap(group => group[index] ? [group[index]] : [])).flat();
  if (settled.length && settled.every(value => value.status === 'rejected')) throw new Error('Archive metadata unavailable');
  return songs;
}
const sourceCache = new Map<string, { tracks: AudiusTrack[]; expires: number }>();
async function cachedSource(source: string, query: string, trending: boolean, signal: AbortSignal, load: () => Promise<AudiusTrack[]>) {
  const key = `${source}:${trending ? 'discover' : `search:${query.trim().toLowerCase().replace(/\s+/g, ' ')}`}`;
  if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
  const saved = sourceCache.get(key);
  if (saved && saved.expires > Date.now()) return saved.tracks;
  sourceCache.delete(key);
  const tracks = await load();
  if (!signal.aborted) { sourceCache.set(key, { tracks, expires: Date.now() + (tracks.length ? 300_000 : 15_000) }); while (sourceCache.size > 48) sourceCache.delete(sourceCache.keys().next().value!); }
  return tracks;
}
async function searchSources(query: string, trending: boolean, signal: AbortSignal, onBatch?: (tracks: AudiusTrack[]) => Promise<void>) {
  const providers = ['Audius', 'Internet Archive', 'ccMixter', 'Jamendo (Openverse)', 'Jamendo'];
  const settled = await Promise.allSettled([cachedSource('Audius', query, trending, signal, () => json(audiusUrl(query, trending), signal).then(parseAudius)), cachedSource('Archive', query, trending, signal, () => archiveSearch(query, trending, signal)), cachedSource('ccMixter', query, trending, signal, () => mixterSearch(query, trending, signal)), cachedSource('Openverse', query, trending, signal, () => openverseSearch(query, trending, signal)), cachedSource('Jamendo', query, trending, signal, () => directJamendo({ query, discover: trending }, signal).then(result => result.tracks))].map(async request => { const tracks = (await request).filter(track => isCatalogUpload(track) && (track.duration == null || track.duration >= 60)); if (!signal.aborted && onBatch) await onBatch(trending ? tracks : relevantTracks(tracks, query)); return tracks; }));
  if (signal.aborted) throw new Error('Search cancelled');
  const failed = settled.flatMap((value, index) => value.status === 'rejected' ? [providers[index]] : []);
  if (failed.length === providers.length) throw new Error('Music providers are unavailable. Try again shortly.');
  const groups = settled.map(value => value.status === 'fulfilled' ? value.value : []);
  const songs = Array.from({ length: Math.max(...groups.map(group => group.length), 0) }, (_, index) => groups.flatMap(group => group[index] ? [group[index]] : [])).flat();
  // Provider + ID identifies an upload; preserve distinct recordings/versions.
  const seen = new Set<string>(); const unique = songs.filter(song => { const key = song.provider?.startsWith('Jamendo') ? song.sourceUrl ?? song.id : `${musicProvider(song)}:${song.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
  return { tracks: (trending ? unique : relevantTracks(unique, query)).slice(0, 50), failed };
}

const mixterItem = z.object({ upload_id: z.number().int().positive(), upload_name: z.string().min(1).max(500), user_real_name: z.string().max(500).optional(), user_name: z.string().max(500), license_url: z.string(), file_page_url: z.string(), files: z.array(z.object({ download_url: z.string(), file_name: z.string() })).max(100) });
export function parseMixter(value: unknown): AudiusTrack[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error('Invalid ccMixter response');
  return value.flatMap(raw => {
    const result = mixterItem.safeParse(raw); if (!result.success) return [];
    const item = result.data; const licenseUrl = freeLicense(item.license_url); if (!licenseUrl) return [];
    const file = item.files.find(file => { try { const url = new URL(file.download_url); return url.protocol === 'https:' && url.hostname === 'ccmixter.org' && url.pathname.startsWith('/content/') && /\.mp3$/i.test(url.pathname) && !url.username && !url.password && !url.port && !url.hash; } catch { return false; } });
    if (!file) return [];
    let source: URL; try { source = new URL(item.file_page_url); } catch { return []; } if (source.protocol !== 'https:' || source.hostname !== 'ccmixter.org' || source.username || source.password) return [];
    return [{ id: `cc${item.upload_id}`, title: item.upload_name, user: { name: item.user_real_name || item.user_name }, provider: 'ccMixter' as const, streamUrl: file.download_url, sourceUrl: source.href, licenseUrl }];
  });
}
export async function mixterSearch(query: string, trending: boolean, signal: AbortSignal) {
  const params = new URLSearchParams({ f: 'json', limit: '10', tags: 'remix', lic: 'by' });
  if (!trending) { params.set('search', query); params.set('search_type', 'all'); }
  let data: unknown;
  if (isMobileBuild && Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url: `https://ccmixter.org/api/query?${params}`, connectTimeout: 10000, readTimeout: 10000, responseType: 'json' });
    if (response.status !== 200) throw new Error('ccMixter unavailable'); data = response.data;
  } else if (!isWebPreview) {
    const reply = await window.focusspace.call({ type: 'music-search', query, discover: trending });
    if (!reply.ok) throw new Error(reply.error); data = reply.data;
  } else data = await json(`/api/ccmixter?${params}`, signal);
  if (signal.aborted) throw new Error('Search cancelled'); return parseMixter(data);
}

const openverseItem = z.object({ id: z.string().uuid(), title: z.string().min(1).max(500), creator: z.string().min(1).max(500), url: z.string(), foreign_landing_url: z.string(), license_url: z.string(), source: z.string(), category: z.string(), mature: z.boolean().optional(), duration: z.number().nonnegative().nullish(), thumbnail: z.string().nullish() });
export function parseOpenverse(value: unknown): AudiusTrack[] {
  const data = z.object({ results: z.array(z.unknown()).max(200) }).parse(value);
  return data.results.flatMap(raw => {
    const parsed = openverseItem.safeParse(raw); if (!parsed.success) return [];
    const item = parsed.data; const licenseUrl = freeLicense(item.license_url);
    if (!licenseUrl || item.source !== 'jamendo' || item.category !== 'music' || item.mature) return [];
    try {
      const streamUrl = jamendoStream(item.url); const source = new URL(item.foreign_landing_url);
      if (source.protocol !== 'https:' || source.hostname !== 'www.jamendo.com' || !/^\/track\/\d+\/?$/.test(source.pathname) || source.username || source.password || source.port || source.hash || source.search || source.pathname.split('/')[2] !== new URL(streamUrl).searchParams.get('trackid')) return [];
      const thumb = item.thumbnail ? new URL(item.thumbnail) : undefined;
      const artwork = thumb?.protocol === 'https:' && thumb.hostname === 'api.openverse.org' && !thumb.username && !thumb.password ? { '480x480': thumb.href } : undefined;
      return [{ id: `ov:${item.id}`, title: item.title, user: { name: item.creator }, provider: 'Jamendo (Openverse)' as const, streamUrl, sourceUrl: source.href, licenseUrl, duration: item.duration ? item.duration / 1000 : undefined, artwork }];
    } catch { return []; }
  });
}
export async function openverseSearch(query: string, trending: boolean, signal: AbortSignal) {
  const url = new URL('https://api.openverse.org/v1/audio/');
  url.search = new URLSearchParams({ q: trending ? 'music' : query.slice(0, 200), category: 'music', source: 'jamendo', license: 'by,by-sa,cc0,pdm', page_size: '20', format: 'json' }).toString();
  return parseOpenverse(await json(url.href, signal));
}

export async function searchMusic(query: string, trending: boolean, signal: AbortSignal, onBatch?: (tracks: AudiusTrack[]) => Promise<void>) {
  if(isPublicDemo){if(signal.aborted)throw new DOMException('Cancelled','AbortError');const tracks=trending?demoTracks:relevantTracks(demoTracks,query);await onBatch?.(tracks);return {tracks,failed:[] as string[],correctedQuery:query};}
  const corrected = trending ? query : correctedSearch(query);
  const batch = onBatch ? (tracks: AudiusTrack[]) => onBatch(trending ? tracks : relevantTracks(tracks, corrected)) : undefined;
  const initial = await searchSources(corrected, trending, signal, batch);
  if (trending || initial.tracks.length || signal.aborted || normalizeSearch(corrected).length < 4) return { ...initial, correctedQuery: corrected };
  // One bounded broadened retry; never fill a nonempty search with unrelated trending songs.
  const words = normalizeSearch(corrected).split(' ');
  const broader = words.length > 1 ? words.reduce((a, b) => a.length >= b.length ? a : b) : words[0].slice(0, 4);
  if (broader === normalizeSearch(corrected)) return { ...initial, correctedQuery: corrected };
  const retry = await searchSources(broader, false, signal, onBatch ? tracks => onBatch(relevantTracks(tracks, corrected)) : undefined);
  return { tracks: relevantTracks(retry.tracks, corrected), failed: [...new Set([...initial.failed, ...retry.failed])], correctedQuery: corrected };
}

// Mood discovery uses genre-filtered browsing, not title/artist search.
export async function browseGenres(genres: readonly string[], signal: AbortSignal) {
 if(isPublicDemo){if(signal.aborted)throw new DOMException('Cancelled','AbortError');return demoTracks.filter(track=>genres.includes(track.genre??''));}
 const settled=await Promise.allSettled(genres.slice(0,2).map(genre=>cachedSource(`Mood:${genre}`,genre,true,signal,async()=>{
  const url=new URL(audiusUrl('',true));url.searchParams.set('genre',genre);
  return parseAudius(await json(url.href,signal));
 })));
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 if(settled.every(value=>value.status==='rejected'))throw new Error('Mood discovery is unavailable');
 return settled.flatMap(value=>value.status==='fulfilled'?value.value:[]);
}

// Shelf discovery has a short metadata budget and never runs expensive spelling retries.
export async function searchCollectionMusic(query: string, trending: boolean, signal: AbortSignal, onBatch?: (tracks: AudiusTrack[]) => Promise<void>) {
 if(isPublicDemo)return searchMusic(query,trending,signal,onBatch);
 const budget = AbortSignal.any([signal, AbortSignal.timeout(3500)]);
 const request = searchSources(query, trending, budget, onBatch).catch(() => ({ tracks: [] as AudiusTrack[], failed: [] as string[] }));
 let timeout: ReturnType<typeof setTimeout>;
 const result = await Promise.race([request, new Promise<{ tracks: AudiusTrack[]; failed: string[] }>(resolve => { timeout = setTimeout(() => resolve({ tracks: [], failed: [] }), 3600); })]);
 clearTimeout(timeout!);
 return result;
}
