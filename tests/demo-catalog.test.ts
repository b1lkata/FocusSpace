import { expect,it } from 'vitest';
import { existsSync } from 'node:fs';
import { demoTracks,demoCollections } from '../src/renderer/music/demoCatalog';
import { moodMix,type ListeningMood } from '../src/renderer/music/moodMix';
import { isUnavailable } from '../src/renderer/music/streamAvailability';
it('bundles original sample files and artwork for every demo song',()=>{
 expect(demoTracks).toHaveLength(18);expect(demoCollections).toHaveLength(3);
 for(const track of demoTracks){expect(existsSync(`public-demo/demo/audio/${track.id}.mp3`)).toBe(true);expect(existsSync(`public-demo/demo/art/${track.id}.svg`)).toBe(true);expect(track.duration).toBeGreaterThanOrEqual(60);expect(track.streamUrl).toBeUndefined();}
 for(const mood of ['Chill','Happy','Focus','Energy','Romance','Night'] as ListeningMood[])expect(moodMix(demoTracks,mood)).not.toHaveLength(0);
});
it('treats invalid cached stream metadata as unavailable without crashing discovery',()=>{
 expect(isUnavailable({id:'unsafe',title:'Song',user:{name:'Artist'},provider:'Jamendo',streamUrl:'javascript:alert(1)'})).toBe(true);
});
