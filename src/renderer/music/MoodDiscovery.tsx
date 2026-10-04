import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { artworkAlternatives, trackArtwork, type AudiusTrack } from './audius';
import { readCollectionCache, readPreloadedCollections } from './collectionCache';
import { readTaste } from './listeningTaste';
import { moodMix, moodGenres, type ListeningMood } from './moodMix';
import { browseGenres } from './providers';
import { availabilityEvent, isUnavailable, playableTracks } from './streamAvailability';
import { songDisplay } from './songDisplay';
import { TrackArtwork } from './TrackArtwork';
import './moodMix.css';
export const listeningMoods = [
  { name: 'Chill', color: '#a2d7cb', symbol: 'wave', caption: 'Take it slow', path: 'M3 14c4-9 8 9 12 0s8 9 12 0M3 22c4-9 8 9 12 0s8 9 12 0' },
  { name: 'Happy', color: '#efd18c', symbol: 'sun', caption: 'A little sunshine', path: 'M16 6v-3m0 26v-3M6 16H3m26 0h-3M7 7l2 2m14 14 2 2M7 25l2-2M23 9l2-2M23 16a7 7 0 1 1-14 0 7 7 0 0 1 14 0' },
  { name: 'Focus', color: '#b8afe8', symbol: 'orbit', caption: 'Find your flow', path: 'M25 16a9 9 0 1 1-9-9M3 16h26M16 7c-5 5-5 13 0 18 5-5 5-13 0-18M25 3v6h6' },
  { name: 'Energy', color: '#f2a383', symbol: 'bolt', caption: 'Turn it up', path: 'M18 2 6 18h9l-1 12 12-17h-9l1-11Z' },
  { name: 'Romance', color: '#e9a6c5', symbol: 'heart', caption: 'Feel a little closer', path: 'M16 27 5 16C-3 8 9-1 16 8c7-9 19 0 11 8L16 27Z' },
  { name: 'Night', color: '#9cbce3', symbol: 'moon', caption: 'After the world quiets', path: 'M26 20A12 12 0 0 1 12 4a12 12 0 1 0 14 16Z' },
] as const;
export function MoodDiscovery({ play }: { play: (track:AudiusTrack,queue:AudiusTrack[])=>void }) {
 const [selected,setSelected]=useState<ListeningMood>();
 const [tracks,setTracks]=useState<AudiusTrack[]>([]),[busy,setBusy]=useState(false),[offline,setOffline]=useState(false),[revision,setRevision]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const pool=useRef(new Map<ListeningMood,AudiusTrack[]>());
 const mood=listeningMoods.find(value=>value.name===selected);
 useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close();},[selected]);
 useEffect(()=>{
  if(!selected)return;
  const abort=new AbortController();setOffline(false);
  const cached=readCollectionCache(localStorage).collections;
  const collections=cached.length?cached:readPreloadedCollections();
  const local=[...collections.flatMap(collection=>collection.tracks),...readTaste(localStorage).data.tracks,...(pool.current.get(selected)??[])].filter(track=>!isUnavailable(track));
  const initial=moodMix(local,selected);setTracks(initial);
  if(initial.length>=6){setBusy(false);return()=>abort.abort();}
  setBusy(true);
  void browseGenres(moodGenres[selected],abort.signal).then(async found=>{
   const candidates=moodMix(found,selected).filter(track=>!isUnavailable(track));
   const checked=await playableTracks(candidates,abort.signal,track=>{
    if(!abort.signal.aborted)setTracks(previous=>moodMix([...previous,track],selected));
   });
   if(!abort.signal.aborted){const combined=[...local,...checked];const mix=moodMix(combined,selected);pool.current.set(selected,mix);setTracks(mix);}
  }).catch(()=>{if(!abort.signal.aborted)setOffline(true);}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});
  return()=>abort.abort();
 },[selected,revision]);
 useEffect(()=>{const prune=()=>setTracks(previous=>previous.filter(track=>!isUnavailable(track)));window.addEventListener(availabilityEvent,prune);return()=>window.removeEventListener(availabilityEvent,prune);},[]);
 function close(){dialog.current?.close();}
 return <section className="music-discover" id="discover" aria-label="Music moods"><div className="music-section-title"><div><span className="music-eyebrow">HOW DO YOU FEEL?</span><h2>A sound for every mood.</h2></div></div><div className="mood-grid">{listeningMoods.map(mood=><button key={mood.name} className="mood-card" style={{'--mood-color':mood.color} as CSSProperties} aria-label={`Explore ${mood.name} music`} aria-haspopup="dialog" aria-pressed={selected===mood.name} onClick={event=>{trigger.current=event.currentTarget;setTracks([]);setBusy(true);setSelected(mood.name);}}><span className={`mood-art ${mood.symbol}`} aria-hidden="true"><i/><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={mood.path}/></svg></span><strong>{mood.name}</strong><small>{mood.caption}</small></button>)}</div>{createPortal(<dialog ref={dialog} className="mood-mix-window" aria-labelledby="mood-mix-title" style={{'--mood-color':mood?.color??'#b8afe8'} as CSSProperties} onClose={()=>{setSelected(undefined);trigger.current?.focus({preventScroll:true});}} onClick={event=>{if(event.target===event.currentTarget)close();}}><div className="mood-mix-content"><header><div><h2 id="mood-mix-title">{mood?.name} mix</h2><p>{mood?.caption}</p></div><button aria-label="Close mood mix" onClick={close}>&#215;</button></header><div className="mood-mix-toolbar"><span role="status">{busy?'Finding your sound...':tracks.length?`${tracks.length} ${tracks.length===1?'song':'songs'}`:'No matching songs yet.'}</span><button onClick={()=>setRevision(value=>value+1)} disabled={busy}>New mix</button></div>{!busy&&!tracks.length&&<p className="mood-mix-empty">{offline?'Discovery is unavailable. Try again shortly.':'Try another mood while this collection grows.'}</p>}<div className="mood-mix-songs">{tracks.map(track=><button className="mood-mix-song" key={`${track.provider??'Audius'}:${track.id}`} onClick={()=>{play(track,tracks);close();}}><TrackArtwork src={trackArtwork(track)} alternatives={artworkAlternatives(track)} title={songDisplay(track).title}/><span><strong>{songDisplay(track).title}</strong><small>{songDisplay(track).artist}</small></span><span className="mood-mix-play" aria-hidden="true">&#9654;</span></button>)}</div></div></dialog>,document.body)}</section>;
}
