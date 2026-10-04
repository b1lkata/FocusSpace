import { isCatalogUpload } from './audius';
import type { AudiusTrack } from './audius';
import { musicStream } from './providers';

const cache = new Map<string, { works: boolean; expires: number }>();
export const availabilityEvent = 'focusspace-stream-unavailable';
const key = (track: AudiusTrack) => musicStream(track);
export function isUnavailable(track: AudiusTrack) { try { const value = cache.get(key(track)); return !!value && !value.works && value.expires > Date.now(); } catch { return true; } }
export function markUnavailable(track: AudiusTrack) {
  cache.set(key(track), { works: false, expires: Date.now() + 60_000 });
  window.dispatchEvent(new Event(availabilityEvent));
}
// Decode a small initial buffer without playing or downloading the whole song.
export async function playableTracks(tracks: AudiusTrack[], signal: AbortSignal, onPlayable?: (track: AudiusTrack) => void): Promise<AudiusTrack[]> {
  let next = 0; const accepted = new Set<string>();
  async function check(track: AudiusTrack) {
    if (!isCatalogUpload(track) || (track.duration != null && track.duration < 60)) return false;
    const url = key(track), saved = cache.get(url);
    if (saved && saved.expires > Date.now()) return saved.works;
    const works = await new Promise<boolean>(resolve => {
      const audio = new Audio(); audio.preload = 'auto'; audio.muted = true;
      const finish = (works: boolean) => { clearTimeout(timeout); signal.removeEventListener('abort', cancel); audio.oncanplay = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); resolve(works); };
      const cancel = () => finish(false);
      const timeout = setTimeout(cancel, 6000);
      audio.oncanplay = () => finish(Number.isFinite(audio.duration) && audio.duration >= 60); audio.onerror = cancel; signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel(); else { audio.src = url; audio.load(); }
    });
    if (!signal.aborted) cache.set(url, { works, expires: Date.now() + (works ? 300_000 : 60_000) });
    return works;
  }
  await Promise.all(Array.from({ length: Math.min(6, tracks.length) }, async () => { while (next < tracks.length && !signal.aborted) { const track = tracks[next++]; if (await check(track)) { accepted.add(key(track)); onPlayable?.(track); } } }));
  if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
  return tracks.filter(track => accepted.has(key(track)) && !isUnavailable(track));
}
