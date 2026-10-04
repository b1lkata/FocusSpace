import type { AudiusTrack } from './audius';
import samples from './demoTracks.json';
export const demoTracks: AudiusTrack[] = samples;
export const demoCollections = ['Tuniko Sessions','Tuniko Studio','Tuniko Lab'].map((artist,index)=>({artist,tracks:demoTracks.filter(track=>track.user.name===artist),cover:`./demo/art/collection${index}.svg`}));
function demoTrack(id:string) { return demoTracks.find(track=>track.id===id); }
export function demoArtwork(id:string) { return demoTrack(id)?`./demo/art/${id}.svg`:undefined; }
export function demoStream(id:string) {
 if(!demoTrack(id))throw new Error('This demo plays only its included sample songs.');
 return new URL(`./demo/audio/${id}.mp3`,document.baseURI).href;
}
