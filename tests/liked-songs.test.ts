import { expect, it } from 'vitest';
import { readLiked, toggleLiked, likedKey } from '../src/renderer/music/likedSongs';
const storage=()=>{const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};};
const track={id:'abc',title:'Adele - Hello',user:{name:'Uploader'},duration:180};
it('persists likes and toggles them without modifying source metadata',()=>{const s=storage();toggleLiked(s,track);expect(readLiked(s)[0]).toEqual(track);toggleLiked(s,track);expect(readLiked(s)).toEqual([]);expect(track.user.name).toBe('Uploader');});
it('preserves malformed liked data instead of overwriting it',()=>{const s=storage();s.setItem(likedKey,'{broken');expect(()=>toggleLiked(s,track)).toThrow();expect(s.getItem(likedKey)).toBe('{broken');});
it('rejects unsafe stream metadata without saving it',()=>{const s=storage();expect(()=>toggleLiked(s,{...track,provider:'Internet Archive',streamUrl:'https://evil.example/a.mp3'})).toThrow();expect(s.getItem(likedKey)).toBeNull();});
