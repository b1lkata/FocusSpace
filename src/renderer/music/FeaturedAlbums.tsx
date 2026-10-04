import { isPublicDemo } from '../runtime';
import { songDisplay } from './songDisplay';
import { useEffect, useRef, useState } from 'react';
import albums from './featuredAlbums.json';
import { artistArtwork } from './artworkIdentity';
import { type AudiusTrack, trackArtwork } from './audius';
import { searchCollectionMusic } from './providers';
import { availabilityEvent, isUnavailable, playableTracks } from './streamAvailability';
import { collectionSongs, collectionVersion, shuffledArtists, minimumCollectionTracks } from './artistCollections';
import { TrackArtwork } from './TrackArtwork';
import './featuredAlbums.css';
import { readCollectionCache, readPreloadedCollections, saveCollectionCache, type ArtistCollection } from './collectionCache';
const sessionArtistOrder = shuffledArtists();
export function FeaturedAlbums({ play }: { play: (track: AudiusTrack, queue: AudiusTrack[]) => void }) {
 const [artistOrder] = useState(() => sessionArtistOrder);
 const [cached] = useState(() => { const saved = readCollectionCache(localStorage); return saved.collections.length ? saved : { ...saved, fresh: false, collections: readPreloadedCollections() }; });
 const [collections, setCollections] = useState<ArtistCollection[]>(() => [...cached.collections].sort((a, b) => artistOrder.indexOf(a.artist) - artistOrder.indexOf(b.artist))), [active, setActive] = useState<string>();
 const [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [message, setMessage] = useState(cached.fresh ? cached.collections.length ? 'Playable artist collections.' : 'No artists with six playable uploads found. Try again as the catalogs update.' : '');
 const shelf = useRef<HTMLDivElement>(null);
 const current = useRef(collections); current.current = collections;
 
 useEffect(() => { const refresh = () => { const values = current.current.map(value => ({ ...value, tracks: value.tracks.filter(track => !isUnavailable(track)) })).filter(value => value.tracks.length >= minimumCollectionTracks(value.artist)); setCollections(values); if (!cached.blocked) { try { saveCollectionCache(localStorage, values); } catch { /* Preserve existing storage on failure. */ } } setRevision(value => value + 1); }; window.addEventListener(availabilityEvent, refresh); return () => window.removeEventListener(availabilityEvent, refresh); }, [cached.blocked]);
 useEffect(() => {
  // Fresh, previously decoded collections render immediately on reopen, without provider requests.
  if (!revision && cached.fresh) return;
  const controller = new AbortController(); setBusy(true); setMessage('Finding your artists...');
  void (async () => {
   const found = new Map<string, ArtistCollection>(current.current.map(value => [value.artist.toLowerCase().trim(), value])), checked = new Set<string>();
   function publish(complete = false) {
    if (controller.signal.aborted) return;
    const order = (artist: string) => { const index = artistOrder.findIndex(name => name.toLowerCase() === artist.toLowerCase()); return index < 0 ? Infinity : index; };
    const values = [...found.values()].sort((a, b) => order(a.artist) - order(b.artist) || a.artist.localeCompare(b.artist)); setCollections(values);
    if (!cached.blocked && (values.length || complete)) { try { saveCollectionCache(localStorage, values); } catch { /* Keep the existing cache and live results if storage is full. */ } }
   }
   async function load(artist: string) {
    const identity = artist.toLowerCase().trim();
    if (controller.signal.aborted || checked.has(identity)) return; checked.add(identity);
    let verified: AudiusTrack[] = [];
    const existing = found.get(identity);
    if (existing) {
     verified = collectionSongs(await playableTracks(existing.tracks, controller.signal), artist);
     if (controller.signal.aborted) return;
     if (verified.length < minimumCollectionTracks(artist)) found.delete(identity); else found.set(identity, { ...existing, tracks: verified });
     publish();
    }
    try {
     await searchCollectionMusic(artist, false, controller.signal, async batch => {
      const candidates = collectionSongs(batch, artist, false);
      for (let offset = 0; offset < candidates.length && !controller.signal.aborted; offset += 6) {
       const playable = await playableTracks(candidates.slice(offset, offset + 6), controller.signal, track => {
        if (controller.signal.aborted) return;
        verified = collectionSongs([...verified, track], artist);
        if (verified.length >= minimumCollectionTracks(artist)) { found.set(identity, { artist, tracks: verified, cover: albums.find(album => album.artist === artist)?.cover ?? trackArtwork(verified[0]) }); publish(); }
       });
       verified = collectionSongs([...verified, ...playable], artist);
       if (verified.length >= minimumCollectionTracks(artist)) { found.set(identity, { artist, tracks: verified, cover: albums.find(album => album.artist === artist)?.cover ?? trackArtwork(verified[0]) }); publish(); }
      }
     });
     if (verified.length < minimumCollectionTracks(artist)) { found.delete(identity); publish(); }
    } catch { /* Failed providers must not produce placeholder songs. */ }
   }
   const pending = [...new Set([...current.current.map(value => value.artist), ...artistOrder])];
   let next = 0;
   async function worker() { while (next < pending.length && !controller.signal.aborted) await load(pending[next++]); }
   await Promise.all(Array.from({ length: 3 }, worker));
   if (!controller.signal.aborted) { publish(true); setMessage(found.size ? 'Playable artist collections.' : 'No artists with six playable uploads found. Try again as the catalogs update.'); }
  })().catch(() => { if (!controller.signal.aborted) setMessage('Collections could not load. Try again.'); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
  return () => controller.abort();
 }, [cached, revision, artistOrder]);
 const collection = collections.find(value => value.artist === active);
 function scroll(direction: number) { shelf.current?.scrollBy({ left: direction * 360, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
 return <section className="featured-albums" aria-label="Artist collections">
  <div className="album-shelf-heading"><div><small>ON REPEAT</small><h2>Your artists.</h2></div><div className="album-arrows"><button aria-label="Previous artists" onClick={() => scroll(-1)}>&#8592;</button><button aria-label="Next artists" onClick={() => scroll(1)}>&#8594;</button></div></div>
  <small>{isPublicDemo ? 'Original instrumental sketches.' : 'Artist-inspired uploads.'}</small><p role="status" data-note={message !== 'Playable artist collections.'}>{message}</p><div className="album-shelf" ref={shelf} aria-busy={busy}>{collections.map((item, index) => <button className={`featured-album album-tone-${index % 5}`} key={item.artist} aria-pressed={active === item.artist} aria-expanded={active === item.artist} onClick={() => setActive(active === item.artist ? undefined : item.artist)}><span className="album-art"><TrackArtwork src={artistArtwork(item.artist) ?? item.cover} title={item.artist} /></span><strong>{item.artist}</strong><small>{item.tracks.length} songs</small></button>)}</div>
  {!busy && <button onClick={() => setRevision(value => value + 1)}>Refresh collections</button>}
  {collection && <div className="featured-album-detail"><div className="album-detail-heading"><h3>{collection.artist}</h3><button aria-label="Close artist collection" onClick={() => setActive(undefined)}>&#215;</button></div><ol>{collection.tracks.map((track, index) => <li key={track.id}><button onClick={() => play(track, collection.tracks)} aria-label={`Play ${songDisplay(track).title}`}><span className="album-track-number">{index + 1}</span><span><strong>{songDisplay(track).title}</strong><small title={`Uploaded by ${track.user.name}`}>{songDisplay(track).artist} &middot; {collectionVersion(track)}</small></span><span aria-hidden="true">&#9655;</span></button>{track.sourceUrl && <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}{track.licenseUrl && <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">License</a>}</li>)}</ol></div>}
 </section>;
}
