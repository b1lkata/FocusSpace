import type { AudiusTrack } from './audius';
import { trackVersion, isCatalogUpload } from './audius';
import { normalizeSearch } from './searchText';
export function artistSongs(tracks: AudiusTrack[], artist: string, deduplicate = true) {
 const seen = new Set<string>();
 return tracks.filter(track => { const title = normalizeSearch(track.title); if (normalizeSearch(track.user.name) !== normalizeSearch(artist) || trackVersion(track) || (track.duration != null && track.duration < 60) || (deduplicate && seen.has(title))) return false; seen.add(title); return true; });
}
export function shortSongName(title: string) { return title.replace(/\s*\((?:feat\.?|ft\.?|featuring)\b[^)]*\)/gi, '').replace(/\s*\[(?:official|audio|video)[^\]]*\]/gi, '').replace(/\s*[-\u2013\u2014]\s*(?:official (?:audio|video)|audio|video|lyrics?)\s*$/i, '').trim() || title; }

// A title mention describes the collection theme, not the upload's authorship.
import { featuredArtists } from './featuredArtists';
export { featuredArtists } from './featuredArtists';
export function titleMentionsArtist(title: string, artist: string) {
 const words = normalizeSearch(title).split(' '), target = normalizeSearch(artist).split(' ');
 return words.some((_, index) => target.every((word, offset) => words[index + offset] === word));
}
export function collectionSongs(tracks: AudiusTrack[], artist: string, deduplicate = true) {
 const seen = new Set<string>();
 return tracks.filter(track => {
  if (!isCatalogUpload(track) || !titleMentionsArtist(track.title, artist) || (track.duration != null && track.duration < 60) || /\b(type beat|type instrumental|playlist|name that tune|ai cover|ai voice|ai generated)\b/i.test(track.title)) return false;
  const title = normalizeSearch(track.title);
  const songWords = featuredArtists.reduce((value, name) => value.replaceAll(` ${normalizeSearch(name)} `, ' '), ` ${title} `).replace(/\b(feat|ft|x|and|official|audio|video|remix|cover|edit)\b/g, '').trim();
  if (!songWords) return false;
  if (deduplicate && seen.has(title)) return false;
  seen.add(title); return true;
 });
}
export function collectionSongName(title: string, artist: string) {
 let value = shortSongName(title);
 const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 const name = artist === 'Beyonce' ? 'Beyonc[e\u00e9]' : escape(artist);
 value = value.replace(new RegExp('^\\s*' + name + '\\s*[-\\u2013\\u2014:]\\s*', 'i'), '');
 value = value.replace(new RegExp('\\s*[-\\u2013\\u2014]\\s*' + name + '(?=\\s*(?:[([]|$))', 'i'), '');
 value = value.replace(/\s*[([][^)\]]*\b(remix|mix|edit|flip|bootleg|cover|rework|mashup|version|sped|slowed|reverb|official|lyrics|audio|video)\b[^)\]]*[)\]]/gi, '');
 value = value.replace(/\s*[-\u2013\u2014]\s*[^-]*\b(remix|edit|flip|bootleg|cover|lyrics|audio|video)\s*$/i, '');
 value = value.replace(/\s+(?:lyrics|cover)\s*$/i, '').trim();
 const creditParts = value.split(/\s+[-\u2013\u2014:]\s+/);
 if (creditParts.length > 1 && titleMentionsArtist(creditParts[0], artist)) value = creditParts.slice(1).join(' - ');
 value = value.replace(/\s*\((?:violin|piano|guitar|instrumental|karaoke)\)\s*$/i, '').replace(/\s*[-\u2013\u2014:]?\s*\bcover\s*$/i, '').trim();
 return value || shortSongName(title);
}
export function shuffledArtists(random: () => number = Math.random) {
 const values = [...featuredArtists];
 for (let index = values.length - 1; index > 0; index--) { const other = Math.floor(random() * (index + 1)); [values[index], values[other]] = [values[other], values[index]]; }
 return values;
}
export function collectionVersion(track: AudiusTrack) {
 return trackVersion(track) || 'Upload';
}

// Keep the requested BTS collection after removing its unwanted sixth track.
export const minimumCollectionTracks = (artist: string) => normalizeSearch(artist) === 'bts' ? 5 : 6;
