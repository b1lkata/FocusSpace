import { z } from 'zod';
import { isPublicDemo } from '../runtime';
export type LyricLine = { time: number; text: string };
export function parseLrc(value: string): LyricLine[] {
  if (value.length > 200_000) throw new Error('Lyrics file is too large');
  const lines: LyricLine[] = []; let offset = 0;
  for (const line of value.split(/\r?\n/)) { const match = line.match(/^\[offset:([+-]?\d+)\]/i); if (match) offset = Math.max(-30, Math.min(30, Number(match[1]) / 1000)); }
  for (const line of value.split(/\r?\n/)) {
    const text = line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    for (const match of line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)) { if (Number(match[2]) >= 60) continue; lines.push({ time: Math.max(0, Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? '0'}`) + offset), text: text.slice(0, 1000) }); }
    if (lines.length > 3000) throw new Error('Too many lyric lines');
  }
  return lines.sort((a, b) => a.time - b.time);
}
export const currentLyric = (lines: LyricLine[], time: number) => lines.reduce((active, line, index) => line.time <= time ? index : active, -1);
const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
export const lyricRecord = z.object({ trackName: z.string().max(500), artistName: z.string().max(500), duration: z.number().nonnegative(), instrumental: z.boolean(), syncedLyrics: z.string().max(200_000).nullish(), plainLyrics: z.string().max(200_000).nullish() });
export function matchedLyrics(value: unknown, title: string, artist: string, duration?: number) {
  const record = lyricRecord.parse(value);
  if (normalize(record.trackName) !== normalize(title) || normalize(record.artistName) !== normalize(artist) || (duration && Math.abs(record.duration - duration) > 2)) throw new Error('Lyrics do not match this recording');
  return { lines: record.syncedLyrics ? parseLrc(record.syncedLyrics) : [], plain: record.plainLyrics ?? '', instrumental: record.instrumental };
}
export async function fetchLyrics(title: string, artist: string, duration: number | undefined, signal: AbortSignal) {
 if(isPublicDemo)return {lines:[] as LyricLine[],plain:'',instrumental:true};
  const url = new URL('https://lrclib.net/api/get'); url.searchParams.set('track_name', title); url.searchParams.set('artist_name', artist); if (duration) url.searchParams.set('duration', String(duration));
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), credentials: 'omit' });
  if (!response.ok) throw new Error('No matching lyrics available');
  const text = await response.text(); if (text.length > 250_000) throw new Error('Lyrics response too large');
  return matchedLyrics(JSON.parse(text), title, artist, duration);
}
