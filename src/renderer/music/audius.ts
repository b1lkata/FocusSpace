import { closeSearchWord, normalizeSearch } from './searchText';
import { z } from 'zod';
import { identifiedArtwork } from './artworkIdentity';
import { isPublicDemo } from '../runtime';
import { demoArtwork } from './demoCatalog';
const artworkUrl = z.unknown().transform(value => {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
});
const trackSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9]{1,32}$/), title: z.string().min(1).max(500), permalink: z.string().max(2048).nullish(), user: z.object({ name: z.string().min(1).max(500) }), artwork: z.object({ '150x150': artworkUrl.optional(), '480x480': artworkUrl.optional(), '1000x1000': artworkUrl.optional() }).nullish().catch(undefined), duration: z.number().nonnegative().optional(), genre: z.string().max(500).nullish(), tags: z.string().max(2000).nullish(), is_stream_gated: z.boolean().optional(), is_available: z.boolean().optional(), is_delete: z.boolean().optional(), is_unlisted: z.boolean().optional(), access: z.object({ stream: z.boolean().optional() }).optional() });
export type AudiusTrack = z.infer<typeof trackSchema> & { provider?: 'Audius' | 'Internet Archive' | 'ccMixter' | 'Jamendo (Openverse)' | 'Jamendo'; artistId?: string; albumId?: string; albumName?: string; streamUrl?: string; sourceUrl?: string; licenseUrl?: string };
const base = 'https://api.audius.co/v1';
export function audiusUrl(query: string, trending = false) {
  const url = new URL(`${base}/tracks/${trending ? 'trending' : 'search'}`);
  url.searchParams.set('app_name', 'FocusSpace'); url.searchParams.set('limit', '50');
  if (!trending) { url.searchParams.set('query', query.trim().slice(0, 200)); url.searchParams.set('sort_method', 'relevant'); }
  else url.searchParams.set('time', 'week');
  return url.href;
}
export function audiusStream(id: string) {
  if (!/^[a-zA-Z0-9]{1,32}$/.test(id)) throw new Error('Invalid Audius track');
  return `${base}/tracks/${id}/stream?app_name=FocusSpace`;
}
export function parseAudius(value: unknown): AudiusTrack[] {
  const raw = z.object({ data: z.array(z.unknown()).max(1000) }).parse(value); const seen = new Set<string>();
  return raw.data.flatMap(value => {
    const parsed = trackSchema.safeParse(value); if (!parsed.success) return [];
    const track = parsed.data;
    if (track.is_stream_gated || track.is_available === false || track.is_delete || track.is_unlisted || track.access?.stream === false || seen.has(track.id)) return [];
    seen.add(track.id); let sourceUrl: string | undefined; try { const url = new URL(track.permalink ?? "", "https://audius.co"); if (track.permalink && url.protocol === "https:" && url.hostname === "audius.co" && !url.username && !url.password && !url.port) sourceUrl = url.href; } catch { /* Missing or invalid public link does not affect playback. */ } return [{ ...track, ...(sourceUrl ? { sourceUrl } : {}) }];
  }).slice(0, 50);
}

export const trackArtwork = (track: AudiusTrack) => isPublicDemo ? demoArtwork(track.id) : identifiedArtwork(track)[0] ?? track.artwork?.['1000x1000'] ?? track.artwork?.['480x480'] ?? track.artwork?.['150x150'];
const normalized = normalizeSearch;
export function trackVersion(track: AudiusTrack) {
  if (track.provider === 'ccMixter') return 'Remix';
  if (/\b(remix|rework|bootleg|flip)\b/i.test(track.title)) return 'Remix';
  if (/\bcover\b/i.test(track.title)) return 'Cover';
  if (/\b(live|acoustic)\b/i.test(track.title)) return 'Live / acoustic';
  if (/\b(mashup|mix|sped|slowed)\b/i.test(track.title)) return 'Alternate version';
  if (/\bedit\b/i.test(track.title)) return 'Edit';
  return '';
}
export const isCatalogUpload = (track: AudiusTrack) => !trackVersion(track) && !((!track.provider || track.provider === 'Audius') && track.id === 'j445o') && !/\bdynamite\s*\(\s*1980\s*\)/i.test(track.title);
const familiarArtists = new Set(['The Weeknd', 'Billie Eilish', 'Bruno Mars', 'Shawn Mendes', 'Drake', 'Ariana Grande', 'Stray Kids', 'Chase Atlantic', 'The Neighbourhood', 'Taylor Swift', 'BTS', 'Blackpink', 'Coldplay', 'Linkin Park', 'Ed Sheeran', 'Dua Lipa', 'Kendrick Lamar', 'SZA', 'Rihanna', 'Beyonce', 'Lady Gaga', 'Justin Bieber', 'Harry Styles', 'Olivia Rodrigo', 'Post Malone', 'Imagine Dragons', 'Lana Del Rey', 'Arctic Monkeys', 'Adele', 'Eminem', 'Travis Scott', 'Bad Bunny', 'Sabrina Carpenter'].map(value => normalized(value).replace(/ /g, '')));
export function rankAudius(tracks: AudiusTrack[], query: string): AudiusTrack[] {
  const term = normalized(query), words = term.split(' ').filter(Boolean);
  if (!term) return tracks;
  const score = (track: AudiusTrack) => {
    const title = normalized(track.title), artist = normalized(track.user.name), text = title + ' ' + artist;
    const tokens = new Set(text.split(' '));
    const coverage = words.filter(word => tokens.has(word)).length / words.length;
    return (title === term ? 1000 : artist === term ? 700 : text.includes(term) ? 400 : 0)
      + coverage * 200 + (!trackVersion(track) && familiarArtists.has(artist.replace(/ /g, '')) ? 40 : 0) - (trackVersion(track) && !/\b(remix|rework|bootleg|flip|cover|live|acoustic|mashup|mix|sped|slowed)\b/i.test(query) ? 180 : 0);
  };
  return tracks.map((track, index) => ({ track, index, score: score(track) })).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.track);
}

export const artworkAlternatives = (track: AudiusTrack) => {
 if(isPublicDemo){const cover=demoArtwork(track.id);return cover?[cover]:[];}
 const identified = identifiedArtwork(track);
 return identified.length ? identified : [...new Set([track.artwork?.['1000x1000'], track.artwork?.['480x480'], track.artwork?.['150x150']].filter((url): url is string => !!url))];
};

export function relevantTracks(tracks: AudiusTrack[], query: string) {
  const words = normalized(query).split(' ').filter(Boolean);
  if (!words.length) return tracks;
  return rankAudius(tracks.filter(track => { const tokens = normalized(`${track.title} ${track.user.name} ${track.albumName ?? ''} ${track.genre ?? ''} ${track.tags ?? ''}`).split(' '); return words.every(word => tokens.some(token => closeSearchWord(word, token))) || (words.length > 1 && normalized(track.user.name).replace(/ /g, '').startsWith(words.join(''))); }), query);
}
