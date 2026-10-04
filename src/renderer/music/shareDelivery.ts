import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isMobileBuild, isWebPreview } from '../runtime';
export const nativeSharing = isMobileBuild && Capacitor.isNativePlatform();
export function canShareCard(file: File) { return nativeSharing || !!navigator.canShare?.({ files: [file] }); }
export function canShareLink() { return nativeSharing || typeof navigator.share === 'function'; }
export async function deliverCard(file: File) {
  if (!nativeSharing) { await navigator.share({ files: [file] }); return; }
  const path = `tuniko-share/${crypto.randomUUID()}.png`;
  const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read card.')); reader.readAsDataURL(file); });
  const saved = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
  try { await Share.share({ files: [saved.uri], dialogTitle: 'Share your song card' }); }
  finally { // Leave the chosen app time to read the granted cache URI.
    setTimeout(() => { void Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {}); }, 10 * 60 * 1000);
  }
}
export async function deliverLink(title: string, text: string, url: string) {
  if (nativeSharing) await Share.share({ title, text, url, dialogTitle: 'Share this song' });
  else await navigator.share({ title, text, url });
}
export async function saveCard(file: File): Promise<boolean> {
  if (!isWebPreview) {
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read card.')); reader.readAsDataURL(file); });
    const result = await window.focusspace.call({ type: 'save-song-card', format: file.name.includes('square') ? 'square' : 'story', data });
    if (!result.ok) throw new Error(result.error);
    return result.data === true;
  }
  const url = URL.createObjectURL(file), anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}
