import { songDisplay } from './songDisplay';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isMobileBuild } from '../runtime';
import { type AudiusTrack } from './audius';
import { musicStream } from './providers';
export const usesNativeAudio = isMobileBuild && Capacitor.isNativePlatform() && ['ios', 'android'].includes(Capacitor.getPlatform());
export type NativePlayback = { id: string; local: boolean; playing: boolean; time: number; duration: number; sleepActive?: boolean; error?: string };
interface NativeAudioPlugin {
  play(options: { tracks: { id: string; title: string; artist: string; url: string }[]; index: number; volume: number }): Promise<void>;
  playLocal(options: { id: string; title: string; data: string; extension: string; volume: number }): Promise<void>;
  pause(): Promise<void>; resume(): Promise<void>; stop(): Promise<void>;
  seek(options: { time: number }): Promise<void>; volume(options: { volume: number }): Promise<void>;
  skip(options: { delta: number }): Promise<void>;
  playbackOptions(options: { repeat?: 'off' | 'all' | 'one'; sleepMinutes?: number }): Promise<void>;
  reorderQueue(options: { order: number[] }): Promise<void>;
  editQueue(options: { from: number; to?: number }): Promise<void>;
  state(): Promise<NativePlayback>;
  addListener(event: 'playback', listener: (state: NativePlayback) => void): Promise<PluginListenerHandle>;
}
export const nativeAudio = registerPlugin<NativeAudioPlugin>('FocusAudio');
export const nativeTracks = (tracks: AudiusTrack[]) => tracks.map(track => ({ id: track.id, title: songDisplay(track).title, artist: songDisplay(track).artist, url: musicStream(track) }));
export function audioBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
}
