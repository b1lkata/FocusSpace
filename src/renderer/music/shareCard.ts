import type { AudiusTrack } from './audius';
export type ShareSong = { title: string; artist: string; artwork?: string; alternatives?: string[]; url?: string; provider?: string; license?: string; color: string };
export function publicSongUrl(track: AudiusTrack): string | undefined {
  try {
    const url = new URL(track.sourceUrl ?? '');
    const host = ({ Audius: 'audius.co', 'Internet Archive': 'archive.org', ccMixter: 'ccmixter.org', 'Jamendo (Openverse)': 'www.jamendo.com', Jamendo: 'www.jamendo.com' } as const)[track.provider ?? 'Audius'];
    if (url.protocol !== 'https:' || url.username || url.password || url.port || ![host, ...(host === 'www.jamendo.com' ? ['jamendo.com'] : [])].includes(url.hostname)) return;
    return url.href;
  } catch { return; }
}
export function songCaption(song: ShareSong) {
  return [`${song.title}${song.artist ? ` — ${song.artist}` : ''}`, 'Listening with Tuniko', song.url, song.provider && `Source: ${song.provider}`, song.license && `License: ${song.license}`].filter(Boolean).join('\n');
}
function lines(ctx: CanvasRenderingContext2D, value: string, width: number, max: number) {
  const result: string[] = []; let line = '';
  for (const char of Array.from(value.slice(0, 500))) {
    if (ctx.measureText(line + char).width > width && line) { result.push(line.trim()); line = ''; }
    line += char;
  }
  if (line) result.push(line.trim());
  const limited = result.slice(0, max);
  if (result.length > max) limited[max - 1] = limited[max - 1].slice(0, -2) + '…';
  return limited;
}
async function artwork(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise(resolve => {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
    const timer = setTimeout(() => done(), 2500);
    function done(value?: HTMLImageElement) { clearTimeout(timer); image.onload = null; image.onerror = null; if (!value) image.src = ''; resolve(value); }
    image.onload = () => done(image); image.onerror = () => done(); image.src = url;
  });
}
export async function makeSongCard(song: ShareSong, format: 'story' | 'square') {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = format === 'story' ? 1920 : 1080;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image cards are unavailable.');
  const height = canvas.height, top = format === 'story' ? 350 : 145, size = format === 'story' ? 700 : 470;
  ctx.fillStyle = '#14121d'; ctx.fillRect(0, 0, 1080, height);
  const glow = ctx.createRadialGradient(780, top + 170, 10, 600, top + 250, 1000);
  glow.addColorStop(0, song.color); glow.addColorStop(1, '#14121d'); ctx.globalAlpha = .4; ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, height); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 2; for (const radius of [390, 530, 670]) { ctx.beginPath(); ctx.arc(540, top + size / 2, radius, 0, Math.PI * 2); ctx.stroke(); }
  let image: HTMLImageElement | undefined;
  for (const url of [...new Set([song.artwork, ...(song.alternatives ?? [])].filter((value): value is string => !!value))].slice(0, 3)) { image = await artwork(url); if (image) break; }
  ctx.save(); ctx.beginPath(); ctx.roundRect((1080 - size) / 2, top, size, size, 32); ctx.clip();
  if (image) { const side = Math.min(image.naturalWidth, image.naturalHeight); ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, (1080 - size) / 2, top, size, size); }
  else { ctx.fillStyle = '#242130'; ctx.fillRect(0, top, 1080, size); ctx.fillStyle = '#101019'; ctx.beginPath(); ctx.arc(540, top + size / 2, size * .4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = song.color; ctx.beginPath(); ctx.arc(540, top + size / 2, size * .14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#14121d'; ctx.beginPath(); ctx.arc(540, top + size / 2, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore(); ctx.textAlign = 'center'; ctx.fillStyle = '#f3edf9'; ctx.font = '600 45px Manrope, sans-serif';
  lines(ctx, song.title, 900, 2).forEach((line, index) => ctx.fillText(line, 540, top + size + 90 + index * 57));
  ctx.fillStyle = '#c2b6d0'; ctx.font = '28px Manrope, sans-serif'; lines(ctx, song.artist || 'On my device', 900, 1).forEach(line => ctx.fillText(line, 540, top + size + 215));
  const footer = format === 'story' ? 200 : 130;
  ctx.fillStyle = song.color; ctx.font = '600 48px Manrope, sans-serif'; ctx.fillText('tuniko.', 540, height - footer);
  ctx.fillStyle = '#b8acc6'; ctx.font = '22px Manrope, sans-serif'; ctx.fillText('A song worth sharing.', 540, height - footer + 45);
  ctx.font = '17px Manrope, sans-serif';
  lines(ctx, [song.artist, song.provider, song.license].filter(Boolean).join(' · '), 960, 2).forEach((line, i) => ctx.fillText(line, 540, height - footer + 88 + i * 24));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Card could not be created.')), 'image/png'));
  return { blob, artworkIncluded: !!image };
}
