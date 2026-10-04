import type { AudiusTrack } from './audius';
import { songDisplay } from './songDisplay';
import verified from './verifiedArtwork.json';

const key = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function artistArtwork(artist: string): string | undefined {
  const covers: Record<string, string> = verified.artists;
  return covers[key(artist)];
}
// Exact title/artist matches use album art. Otherwise use the referenced artist's
// collection cover, never an unrelated uploader image for a familiar artist.
export function identifiedArtwork(track: AudiusTrack): string[] {
  const display = songDisplay(track);
  const songs: Record<string, { cover: string }> = verified.songs;
  const exact = songs[`${key(display.artist)}|${key(display.title)}`]?.cover;
  const artist = display.artist.split(' & ').map(artistArtwork).find(Boolean);
  return [...new Set([exact, artist].filter((value): value is string => !!value))];
}
