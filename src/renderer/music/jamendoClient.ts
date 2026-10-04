import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { jamendoQuery, jamendoResult, type JamendoQuery } from '../../shared/jamendo';
import { isMobileBuild, isWebPreview } from '../runtime';
import { isPublicDemo } from '../runtime';

export async function directJamendo(raw: JamendoQuery, signal: AbortSignal) {
  if(isPublicDemo)return {configured:false,tracks:[]};
  const options = jamendoQuery.parse(raw);
  let data: unknown;
  if (!isWebPreview) {
    const reply = await window.focusspace.call({ type: 'jamendo-search', options });
    if (!reply.ok) throw new Error(reply.error);
    data = reply.data;
  } else {
    let base = location.origin;
    if (isMobileBuild) {
      const configured = import.meta.env.VITE_MUSIC_BACKEND_URL;
      if (!configured) return { configured: false, tracks: [] };
      const url = new URL(configured);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid music server');
      base = url.origin;
    }
    const url = new URL('/api/jamendo', base);
    Object.entries(options).forEach(([key, value]) => { if (value !== undefined) url.searchParams.set(key, String(value)); });
    if (isMobileBuild && Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({ url: url.href, connectTimeout: 10000, readTimeout: 12000, responseType: 'json' });
      if (response.status !== 200) throw new Error('Jamendo unavailable');
      data = response.data;
    } else {
      const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
      if (!response.ok) throw new Error('Jamendo unavailable');
      data = await response.json();
    }
  }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  return jamendoResult.parse(data);
}
