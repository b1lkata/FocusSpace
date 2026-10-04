import { expect,it } from 'vitest';
import { moodMix,moodScore } from '../src/renderer/music/moodMix';
const track=(id:string,title:string,genre?:string,tags?:string)=>({id,title,user:{name:'Independent artist'},duration:180,genre,tags});
it('uses style metadata without requiring mood words in a title',()=>{
 const instrumental=track('a','Cloud atlas','Ambient');
 expect(moodMix([instrumental,track('b','Focus'),track('c','Happy')],'Focus',()=>.5)).toEqual([instrumental]);
 expect(moodMix([track('d','A new day','Funk')],'Happy')).toHaveLength(1);
});
it('uses curated song identity rather than assigning a whole artist to one mood',()=>{
 const slow=track('a','The Weeknd - Call out my name','Pop');const dance=track('b','The Weeknd - Blinding lights','Pop');
 expect(moodScore(slow,'Night')).toBe(100);expect(moodScore(slow,'Energy')).toBe(0);
 expect(moodScore(dance,'Energy')).toBe(100);
 expect(moodScore({...dance,genre:'Lo-Fi'},'Focus')).toBe(0);
});
it('excludes short tracks and modified versions, deduplicates songs and limits artist repetition',()=>{
 const input=Array.from({length:8},(_,i)=>track(String(i),'Track '+i,'Ambient'));
 input.push(track('dup','Track 0','Ambient'),track('remix','Cloud remix','Ambient'),{...track('short','Cloud','Ambient'),duration:59});
 expect(moodMix(input,'Focus',()=>.5)).toHaveLength(3);
});
