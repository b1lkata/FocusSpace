import { playlistTrackSchema } from './playlists';
import { z } from 'zod';
import { isCatalogUpload, type AudiusTrack } from './audius';
import { songDisplay } from './songDisplay';
import { normalizeSearch } from './searchText';
export const tasteKey = 'tuniko.listening-taste.v1';
export const tasteEvent = 'tuniko-taste-changed';
const schema = z.object({ version: z.literal(1), tracks: z.array(playlistTrackSchema).max(24).optional().default([]), recent: z.array(z.string().trim().min(1).max(200)).max(12), listens: z.array(z.object({ id: z.string().max(1100), artist: z.string().max(500), genre: z.string().max(500), seconds: z.number().min(0).max(3600).optional(), at: z.number().finite().nonnegative() })).max(80) });
export type ListeningTaste = z.infer<typeof schema>;
export function readTaste(storage: Pick<Storage, 'getItem'>) {
 try { const raw = storage.getItem(tasteKey); if (raw && raw.length > 100_000) throw new Error('Oversized preferences'); return { data: raw ? schema.parse(JSON.parse(raw)) : schema.parse({version:1,recent:[],listens:[]}), blocked: false }; }
 catch { return { data: schema.parse({version:1,recent:[],listens:[]}), blocked: true }; }
}
export function updateTaste(storage: Pick<Storage, 'getItem' | 'setItem'>, update: (value: ListeningTaste) => ListeningTaste) {
 const saved = readTaste(storage); if (saved.blocked) return false;
 try { const serialized=JSON.stringify(schema.parse(update(saved.data)));if(serialized.length>100_000)return false;storage.setItem(tasteKey, serialized); return true; } catch { return false; }
}
export function rememberSearch(storage: Pick<Storage, 'getItem' | 'setItem'>, query: string) {
 const term = query.trim().slice(0,200); if (!term) return false;
 return updateTaste(storage, value => ({...value,recent:[term,...value.recent.filter(item=>normalizeSearch(item)!==normalizeSearch(term))].slice(0,12)}));
}
export function rememberListen(storage: Pick<Storage, 'getItem' | 'setItem'>, track: AudiusTrack, now = Date.now()) {
 if (!isCatalogUpload(track)) return false;
 const id = `${track.provider ?? 'Audius'}:${track.id}`;
 return updateTaste(storage, value => ({...value,tracks:[playlistTrackSchema.parse(track),...value.tracks.filter(item=>`${item.provider??'Audius'}:${item.id}`!==id)].slice(0,24),listens:[{id,artist:normalizeSearch(songDisplay(track).artist),genre:normalizeSearch(track.genre ?? ''),at:now},...value.listens.filter(item=>item.id!==id)].slice(0,80)}));
}
export function recommendedTracks(pool: AudiusTrack[], taste: ListeningTaste, limit = 6) {
 const artist = new Map<string,number>(), genre = new Map<string,number>();
 taste.listens.forEach((item,index)=>{ const weight=(item.seconds && item.seconds>=30 ? 2 : 1)/(1+index/8); artist.set(item.artist,(artist.get(item.artist)??0)+weight); if(item.genre) genre.set(item.genre,(genre.get(item.genre)??0)+weight); });
 const seen=new Set<string>(), counts=new Map<string,number>();
 const ranked=pool.filter(track=>{ const id=`${track.provider??'Audius'}:${track.id}`; if(seen.has(id)||!isCatalogUpload(track)||(track.duration!=null&&track.duration<60))return false;seen.add(id);return true; }).map((track,index)=>({track,index,artist:normalizeSearch(songDisplay(track).artist),score:(artist.get(normalizeSearch(songDisplay(track).artist))??0)*4+(genre.get(normalizeSearch(track.genre??''))??0)})).filter(item=>item.score>0&&`${item.track.provider??'Audius'}:${item.track.id}`!==taste.listens[0]?.id).sort((a,b)=>b.score-a.score||a.index-b.index);
 const result:AudiusTrack[]=[];
 for(const item of ranked) { if((counts.get(item.artist)??0)>=2)continue;result.push(item.track);counts.set(item.artist,(counts.get(item.artist)??0)+1);if(result.length>=limit)break; }
 return result;
}
export function announceTaste() { window.dispatchEvent(new Event(tasteEvent)); }

export function rememberListeningTime(storage: Pick<Storage,'getItem'|'setItem'>, track:AudiusTrack) { const id=`${track.provider??'Audius'}:${track.id}`;return updateTaste(storage,value=>({...value,listens:value.listens.map(item=>item.id===id?{...item,seconds:Math.min(3600,(item.seconds??0)+30)}:item)})); }
