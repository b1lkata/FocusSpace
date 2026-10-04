import type { AudiusTrack } from './audius';
import { featuredArtists } from './featuredArtists';
import { collectionSongName, collectionVersion, titleMentionsArtist } from './artistCollections';
import { normalizeSearch } from './searchText';

const artists = [...featuredArtists, 'Stray Kids', 'Chase Atlantic', 'Skrillex', 'Diplo', 'Zedd', 'Steve Aoki', 'Calvin Harris', 'Lady Gaga', 'Sia', 'David Guetta', 'Avicii', 'Maroon 5', 'Michael Jackson', 'Queen', 'The Beatles', 'Metallica', 'Nirvana', 'Radiohead', 'One Direction', 'Justin Timberlake', 'Sam Smith', 'Halsey', 'Doja Cat', 'Future', 'Lil Nas X', 'XXXTentacion', 'Juice WRLD', 'Selena Gomez', 'Camila Cabello', 'Charlie Puth', 'Katy Perry', 'Demi Lovato', 'Lil Wayne', 'Nicki Minaj', 'A$AP Rocky', 'Tyler, The Creator', 'J. Cole', 'Frank Ocean'];
const cache = new WeakMap<AudiusTrack, ReturnType<typeof describe>>();
export const capitalizeSong = (title: string) => title.trim().replace(/\p{L}/u, letter => letter.toLocaleUpperCase());
function describe(track: AudiusTrack) {
 // A credited remixer in parentheses should not replace the song's referenced artist.
 const mainTitle = track.title.replace(/\([^)]*\b(remix|edit|flip|bootleg|cover|rework|mix)\b[^)]*\)|\[[^\]]*\b(remix|edit|flip|bootleg|cover|rework|mix)\b[^\]]*\]/gi, '');
 const reference = artists.some(artist => titleMentionsArtist(mainTitle, artist)) ? mainTitle : track.title;
 const text = normalizeSearch(reference);
 const matches = artists.filter(artist => titleMentionsArtist(reference, artist)).sort((a, b) => text.indexOf(normalizeSearch(a)) - text.indexOf(normalizeSearch(b)));
 let title = track.title;
 for (const artist of matches.length ? matches : [track.user.name]) title = collectionSongName(title, artist);
 for (const artist of matches) {
  const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  title = title.replace(new RegExp('^' + escaped + '\\s+', 'i'), '');
 }
 title = title.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, '').trim();
 return { title: capitalizeSong(title), artist: matches.length ? matches.map(name => name === 'Beyonce' ? 'Beyoncé' : name).join(' & ') : track.user.name, uploader: track.user.name, version: collectionVersion(track), inferred: matches.length > 0 };
}
// Presentation only: provider identity, full metadata, playlists and stream URLs stay intact.
export function songDisplay(track: AudiusTrack) {
 let display = cache.get(track);
 if (!display) { display = describe(track); cache.set(track, display); }
 return display;
}
