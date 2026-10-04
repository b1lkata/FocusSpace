export type Song = { id: string; title: string; artist: string; artistId: string; mood: string };
export const songs: Song[] = [
  { id: 'S0Q4gqBUs7c', title: 'Kerala', artist: 'Bonobo', artistId: 'bonobo', mood: 'drift' },
  { id: 'V9PVRfjEBTI', title: 'BIRDS OF A FEATHER', artist: 'Billie Eilish', artistId: 'billie', mood: 'drift' },
  { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', artistId: 'weeknd', mood: 'afterhours' },
  { id: '5NV6Rdv1a3I', title: 'Get Lucky', artist: 'Daft Punk', artistId: 'daft', mood: 'glow' },
];
export function youtubeId(input: string): string | undefined {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    let id: string | null | undefined;
    if (url.hostname === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) id = url.searchParams.get('v') ?? (/^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : undefined);
    return id && /^[\w-]{11}$/.test(id) ? id : undefined;
  } catch { return; }
}
export function youtubeSearch(query: string) { return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`; }
export function findSongs(query: string, artistId = '') {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return songs.filter(song => (!artistId || song.artistId === artistId) && words.every(word => `${song.title} ${song.artist}`.toLocaleLowerCase().includes(word)));
}
