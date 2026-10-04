import { isPublicDemo } from '../runtime';
import { useEffect, useState } from 'react';
import { readCollectionCache, readPreloadedCollections } from './collectionCache';
import { readTaste, recommendedTracks, tasteEvent } from './listeningTaste';
import { isCatalogUpload, trackArtwork, artworkAlternatives, type AudiusTrack } from './audius';
import { availabilityEvent, isUnavailable } from './streamAvailability';
import { songDisplay } from './songDisplay';
import { songIdentity, LikeButton } from './likedSongs';
import { TrackArtwork } from './TrackArtwork';
export function HomeFeed({play}:{play:(track:AudiusTrack,queue:AudiusTrack[])=>void}) {
 const load=()=>{const cache=readCollectionCache(localStorage).collections;return {collections:cache.length?cache:readPreloadedCollections(),taste:readTaste(localStorage)};};
 const [data,setData]=useState(load);
 useEffect(()=>{const update=()=>setData(load());window.addEventListener(tasteEvent,update);window.addEventListener(availabilityEvent,update);return()=>{window.removeEventListener(tasteEvent,update);window.removeEventListener(availabilityEvent,update);};},[]);
 const eligible=(track:AudiusTrack)=>isCatalogUpload(track)&&!isUnavailable(track)&&(track.duration==null||track.duration>=60);
 const pool=data.collections.flatMap(collection=>collection.tracks).filter(eligible);
 const personal=recommendedTracks(pool,data.taste.data,8);
 const seen=new Set<string>();const suggestions=[...personal,...data.collections.flatMap(collection=>collection.tracks.filter(eligible).slice(0,isPublicDemo?2:1))].filter(track=>{const id=songIdentity(track);if(seen.has(id))return false;seen.add(id);return true;}).slice(0,8);
 const recent=data.taste.data.tracks.filter(eligible).slice(0,8);
 function row(title:string,tracks:AudiusTrack[]) {return <section className="home-feed-section" aria-label={title}><h2>{title}</h2><div className="home-song-strip">{tracks.map(track=><article className="home-song-card" key={songIdentity(track)}><button className="home-song-play" aria-label={`Play ${songDisplay(track).title} by ${songDisplay(track).artist}`} onClick={()=>play(track,tracks)}><TrackArtwork src={trackArtwork(track)} alternatives={artworkAlternatives(track)} title={songDisplay(track).title}/><strong>{songDisplay(track).title}</strong><small>{songDisplay(track).artist}</small></button><LikeButton track={track}/></article>)}</div></section>;}
 return <div className="home-feed">{suggestions.length?row('For you',suggestions):<section className="home-feed-section"><h2>For you</h2><p>Choose a mood to start discovering.</p></section>}{recent.length>0&&row('Recently played',recent)}</div>;
}
