import { isCatalogUpload, type AudiusTrack } from './audius';
import { normalizeSearch } from './searchText';
import { songDisplay } from './songDisplay';
import { shuffledSuggestions } from './suggestions';
export type ListeningMood = 'Chill' | 'Happy' | 'Focus' | 'Energy' | 'Romance' | 'Night';
// These are editorial song selections, not title keyword searches or measured
// audio features. Metadata provides additional independent-catalog discovery.
const selections: Record<ListeningMood, string[]> = {
 Chill: ['Ariana Grande|pov','Billie Eilish|Birds of a feather','Billie Eilish|Lovely','SZA|Snooze','SZA|Good days','Coldplay|Sparks','Lana Del Rey|Video games','The Weeknd|Out of time','Ed Sheeran|The hills of Aberfeldy','Shawn Mendes|Wonder'],
 Happy: ['Bruno Mars|The lazy song','Bruno Mars|Uptown funk','Taylor Swift|Shake it off','Taylor Swift|Cruel summer','BTS|Butter','Coldplay|Adventure of a lifetime','Dua Lipa|Levitating','Dua Lipa|Dance the night','Ariana Grande|Into you','Sabrina Carpenter|Espresso'],
 Focus: [],
 Energy: ['The Weeknd|Blinding lights','The Weeknd|Starboy','Dua Lipa|Physical','Dua Lipa|Dont start now','Taylor Swift|Bad blood','BTS|Mic drop','BLACKPINK|Boombayah','BLACKPINK|DDU-DU DDU-DU','Imagine Dragons|Believer','Imagine Dragons|Thunder','Ariana Grande|Break free','Eminem|Lose yourself'],
 Romance: ['Bruno Mars|Die with a smile','Bruno Mars|Talking to the moon','Ed Sheeran|Perfect','Ed Sheeran|Thinking out loud','Adele|Make you feel my love','Adele|Someone like you','Taylor Swift|Love story','Shawn Mendes|Senorita','Ariana Grande|Positions','Lana Del Rey|Young and beautiful','Rihanna|Stay'],
 Night: ['The Weeknd|The hills','The Weeknd|Wicked games','The Weeknd|Call out my name','The Weeknd|After hours','The Neighbourhood|Sweater weather','The Neighbourhood|Daddy issues','Lana Del Rey|Summertime sadness','Billie Eilish|Lovely','Drake|Passionfruit','Drake|Marvins room','SZA|Snooze'],
};
const compact = (text:string) => normalizeSearch(text).replace(/ /g,'');
const curated = Object.fromEntries(Object.entries(selections).map(([mood, songs])=>[mood,songs.map(song=>song.split('|').map(compact))])) as Record<ListeningMood,string[][]>;
const signals: Record<ListeningMood, string[]> = {
 Chill:['chill','chillout','downtempo','acoustic','relaxing','mellow'],
 Happy:['happy','uplifting','upbeat','feel good','disco','funk'],
 Focus:['instrumental','ambient','lo fi','lofi','study','meditation','classical'],
 Energy:['dance','house','techno','electro','drum bass','dubstep','energetic','workout','trap'],
 Romance:['romantic','romance','love song','ballad'],
 Night:['nocturnal','night','dark ambient','trip hop','chill r b'],
};
export const moodGenres: Record<ListeningMood,string[]> = {Chill:['Acoustic','Downtempo'],Happy:['Disco','Funk'],Focus:['Ambient','Lo-Fi'],Energy:['House','Techno'],Romance:['Soul','R&B/Soul'],Night:['Downtempo','Ambient']};
export function moodScore(track:AudiusTrack,mood:ListeningMood) {
 const display=songDisplay(track), artist=compact(display.artist);
 const title=compact(display.title.replace(/\[[^\]]*\]|\((?:official|audio|video)[^)]*\)/gi,''));
 const matches=(name:ListeningMood)=>curated[name].some(([a,t])=>artist.includes(a)&&(title===t||title===a+t));
 if(matches(mood))return 100;
 // Known vocal songs should not enter an instrumental Focus mix because of a
 // loosely supplied genre tag on a community upload.
 if(mood==='Focus'&&(Object.keys(selections) as ListeningMood[]).some(matches))return 0;
 const metadata=` ${normalizeSearch(`${track.genre??''} ${track.tags??''}`)} `;
 return signals[mood].reduce((score,signal)=>score+(metadata.includes(` ${signal} `)?20:0),0);
}
export function moodMix(tracks:AudiusTrack[],mood:ListeningMood,random:()=>number=Math.random,limit=24) {
 const candidates=shuffledSuggestions(tracks,random).filter(track=>isCatalogUpload(track)&&(track.duration==null||track.duration>=60)).map(track=>({track,score:moodScore(track,mood)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score);
 const seen=new Set<string>(),counts=new Map<string,number>();const result:AudiusTrack[]=[];
 for(const {track} of candidates){const display=songDisplay(track);const identity=compact(display.artist)+'|'+compact(display.title);const artist=compact(display.artist);if(seen.has(identity)||(counts.get(artist)??0)>=3)continue;seen.add(identity);counts.set(artist,(counts.get(artist)??0)+1);result.push(track);if(result.length>=limit)break;}
 return result;
}
