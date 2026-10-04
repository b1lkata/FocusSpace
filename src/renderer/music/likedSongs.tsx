import { musicProvider } from './providers';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { playlistTrackSchema } from './playlists';
import { isCatalogUpload, trackArtwork, type AudiusTrack } from './audius';
import { songDisplay } from './songDisplay';
import { isUnavailable } from './streamAvailability';
import { TrackArtwork } from './TrackArtwork';
export const likedKey = 'tuniko.liked-songs.v1';
const event = 'tuniko-liked-changed';
const schema = z.object({version:z.literal(1),tracks:z.array(playlistTrackSchema).max(200)});
export const songIdentity=(track:AudiusTrack)=>`${track.provider??'Audius'}:${track.id}`;
export function readLiked(storage:Pick<Storage,'getItem'>) { const raw=storage.getItem(likedKey); if(raw && raw.length>1_000_000)throw new Error('Oversized liked songs');return raw?schema.parse(JSON.parse(raw)).tracks:[]; }
export function toggleLiked(storage:Pick<Storage,'getItem'|'setItem'>,track:AudiusTrack) { const tracks=readLiked(storage);const id=songIdentity(track);const next=tracks.some(item=>songIdentity(item)===id)?tracks.filter(item=>songIdentity(item)!==id):[playlistTrackSchema.parse(track),...tracks];storage.setItem(likedKey,JSON.stringify(schema.parse({version:1,tracks:next}))); }
function useLiked() { const [tracks,setTracks]=useState<AudiusTrack[]>([]),[error,setError]=useState('');useEffect(()=>{const load=()=>{try{setTracks(readLiked(localStorage));setError('');}catch{setError('Liked songs could not be read. Saved data is preserved.');}};load();window.addEventListener(event,load);return()=>window.removeEventListener(event,load);},[]);return {tracks,error}; }
export function LikeButton({track}:{track:AudiusTrack}) {const {tracks,error}=useLiked();const [failure,setFailure]=useState('');const liked=tracks.some(item=>songIdentity(item)===songIdentity(track));return <><button className="song-heart" aria-label={`${liked?'Unlike':'Like'} ${songDisplay(track).title}`} aria-pressed={liked} disabled={!!error} onClick={()=>{try{toggleLiked(localStorage,track);setFailure('');window.dispatchEvent(new Event(event));}catch{setFailure('Could not save liked songs. Existing data is preserved.');}}}>{liked?'♥':'♡'}</button>{(failure||error)&&<small role="status">{failure||error}</small>}</>;}
export function LikedSongs({play}:{play:(track:AudiusTrack,queue:AudiusTrack[])=>void}) {const {tracks,error}=useLiked();const available=tracks.filter(track=>isCatalogUpload(track)&&!isUnavailable(track));return <section className="liked-songs" aria-label="Liked songs"><details><summary>Liked songs <small>{available.length}</small></summary>{error&&<p role="status">{error}</p>}{!available.length&&!error&&<p>Tap a heart to keep a song here.</p>}{available.map(track=><div className="liked-song" key={songIdentity(track)}><TrackArtwork src={trackArtwork(track)} title={songDisplay(track).title}/><button className="liked-title" onClick={()=>play(track,available)}><strong>{songDisplay(track).title}</strong><small>{songDisplay(track).artist} &middot; {musicProvider(track)}</small></button><LikeButton track={track}/></div>)}</details></section>;}
