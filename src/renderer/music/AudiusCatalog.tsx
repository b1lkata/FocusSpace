import { isPublicDemo } from '../runtime';
import { LikeButton } from './likedSongs';
import { readTaste, rememberSearch, updateTaste, announceTaste, tasteEvent, recommendedTracks } from './listeningTaste';
import { readCollectionCache, readPreloadedCollections } from './collectionCache';
import { shuffledSuggestions } from './suggestions';
import { songDisplay } from './songDisplay';
import { correctedSearch, normalizeSearch } from './searchText';
import { JamendoDiscovery } from './JamendoDiscovery';
import './jamendo.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../design/Icon';
import { artworkAlternatives, relevantTracks, trackArtwork, trackVersion, type AudiusTrack } from './audius';
import { searchMusic, musicProvider } from './providers';
import { TrackArtwork } from './TrackArtwork';
import { playableTracks, availabilityEvent, isUnavailable } from './streamAvailability';
import { PlaylistLibrary } from './PlaylistLibrary';
import { readPlaylists, writePlaylists, playlistTrack, type Playlist } from './playlists';

export function AudiusCatalog({ query, setQuery, play }: { query: string; setQuery: (value: string) => void; play: (track: AudiusTrack, queue: AudiusTrack[]) => void }) {
  const [library] = useState(() => { try { return { lists: readPlaylists(localStorage), error: '' }; } catch { return { lists: [] as Playlist[], error: 'Saved playlists could not be read. Your data has been preserved.' }; } });
  const [lists, setLists] = useState(library.lists);
  const [playlistError, setPlaylistError] = useState(library.error);
  const [adding, setAdding] = useState<AudiusTrack | null>(null);
  const [playlistNotice, setPlaylistNotice] = useState('');
  function save(lists: Playlist[]) { if (playlistError) return false; try { writePlaylists(localStorage, lists); setLists(lists); return true; } catch { setPlaylistError('Playlists could not be saved. Existing data has been preserved.'); return false; } }
  const [taste, setTaste] = useState(() => readTaste(localStorage));
  useEffect(() => { const refresh = () => setTaste(readTaste(localStorage)); window.addEventListener(tasteEvent, refresh); return () => window.removeEventListener(tasteEvent, refresh); }, []);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AudiusTrack[]>(() => {
    const saved = readCollectionCache(localStorage).collections;
    const collections = saved.length ? saved : readPreloadedCollections();
    const seen = new Set<string>();
    return collections.flatMap(collection => collection.tracks).filter(track => { const key = `${musicProvider(track)}:${track.id}`; if (seen.has(key) || isUnavailable(track)) return false; seen.add(key); return true; });
  });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [selected, setSelected] = useState('');
  const [pendingTrack, setPendingTrack] = useState('');
  useEffect(() => { const update = (event: Event) => setPendingTrack((event as CustomEvent<string>).detail); window.addEventListener('tuniko-playback-pending', update); return () => window.removeEventListener('tuniko-playback-pending', update); }, []);
  const suggestionController = useRef<AbortController | undefined>(undefined);
  const searchBox = useRef<HTMLDivElement>(null);
  useEffect(() => { setDock(document.getElementById('music-search-dock')); return () => suggestionController.current?.abort(); }, []);
  const [, refreshAvailability] = useState(0);
  useEffect(() => { const refresh = () => { setTracks(value => value.filter(track => !isUnavailable(track))); setSuggestions(value => value.filter(track => !isUnavailable(track))); refreshAvailability(value => value + 1); }; window.addEventListener(availabilityEvent, refresh); return () => window.removeEventListener(availabilityEvent, refresh); }, []);
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [message, setMessage] = useState('Find your sound. Stream it here.');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState('');
  const [resultType,setResultType] = useState<'songs'|'artists'>('songs');
  const [limit, setLimit] = useState(12);
  const resultScroll = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { controller.current?.abort(); clearTimeout(typingTimer.current); }, []);
  async function search(trending = false, queryOverride?: string, albumTrack?: { title: string; artist: string }) {
    if (!trending && !(queryOverride ?? query).trim()) return;
    clearTimeout(typingTimer.current); setFocused(true); suggestionController.current?.abort(); setSuggesting(false);
    controller.current?.abort();
    const request = new AbortController(); controller.current = request; 
    const term = (queryOverride ?? query).trim();
    if(term!==searched)resultScroll.current=0;
    setBusy(true); setMessage('Finding your next favorite...'); setSearched(trending ? '' : term); setLimit(12);
    try {
      const matchingTerm = correctedSearch(term);
      let results: AudiusTrack[] = relevantTracks(suggestions.filter(track=>!isUnavailable(track)),matchingTerm).slice(0,50);
      if(results.length){setTracks(results);setMessage('Cached matches. Checking catalogs...');}
      const result = await searchMusic(term, trending, request.signal, async batch => {
        for (let offset = 0; offset < Math.min(batch.length, 50) && results.length < 50; offset += 12) {
        const candidates = albumTrack ? batch.filter(track => normalizeSearch(track.user.name) === normalizeSearch(albumTrack.artist) && normalizeSearch(track.title) === normalizeSearch(albumTrack.title) && !trackVersion(track)) : batch;
        const playable = await playableTracks(candidates.slice(offset, offset + 12), request.signal);
        if (controller.current !== request || request.signal.aborted) return;
        const combined = [...results, ...playable]; const seen = new Set<string>();
        results = relevantTracks(combined.filter(track => { const key = `${musicProvider(track)}:${track.id}`; if (seen.has(key)) return false; seen.add(key); return true; }), matchingTerm).slice(0, 50);
        if (results.length) setTracks(results); setMessage(results.length ? `Results for "${term}" - checking other sources` : 'Checking other sources...');
        }
      });
      if (controller.current !== request) return;
      setTracks(results); setMessage(results.length ? `Results for "${result.correctedQuery}"${normalizeSearch(result.correctedQuery) !== normalizeSearch(term) ? ` ? Matched from "${term}"` : ''}` : `No playable matches for "${term}". The free catalogs may not carry this artist or release. Try the full title and artist.`);
      if (results.length && !trending && rememberSearch(localStorage, term)) announceTaste();
      if (result.failed.length) setMessage(value => `${value} ${result.failed.join(', ')} is unavailable; showing other sources.`);
    } catch (error) { if (controller.current !== request) return; if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Music could not load.'); else setMessage('Search took too long. Try again.'); }
    finally { if (controller.current === request) { setBusy(false); controller.current = undefined; } }
  }
  async function showSuggestions(forceShuffle = false) {
    const opening = forceShuffle || !focused;
    setFocused(true);
    if (query.trim()) return;
    if (suggestions.length) { if (opening) setSuggestions(value => shuffledSuggestions(value)); return; }
    if (suggesting) return;
    const request = new AbortController(); suggestionController.current = request; setSuggesting(true); setSuggestionError('');
    try { const result = await searchMusic('', true, request.signal); if (!request.signal.aborted) { const available = await playableTracks(result.tracks.slice(0, 24), request.signal); if (request.signal.aborted) return; setSuggestions(shuffledSuggestions(available)); if (!available.length) setSuggestionError('Try a title, artist, or mood.'); } }
    catch { if (!request.signal.aborted) setSuggestionError('Suggestions are resting. Try searching.'); }
    finally { if (suggestionController.current === request) { setSuggesting(false); suggestionController.current = undefined; } }
  }
  function select(track: AudiusTrack, queue: AudiusTrack[]) { setSelected(track.id); setFocused(false); play(track, queue); }
  const available = tracks.length ? tracks.slice(0, 6) : suggestions.filter(track => !query.trim() || `${track.title} ${track.user.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const personal = recommendedTracks(suggestions.filter(track => !isUnavailable(track)), taste.data);
  const suggested = query.trim() ? available : [...personal, ...suggestions.filter(track => !personal.some(item => item.id === track.id && musicProvider(item) === musicProvider(track)))].slice(0, 6);
  const artistGroups = [...new Set(tracks.map(track=>songDisplay(track).artist))].map(artist=>({artist,tracks:tracks.filter(track=>songDisplay(track).artist===artist)}));
  const searchControl = <div className={`search-control ${busy ? 'searching' : ''}`} ref={searchBox} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }} onKeyDown={event => { if (event.key === 'Escape') { searchBox.current?.querySelector('input')?.focus(); setFocused(false); } }}>
    <form id="catalog-search-form" className="song-search" onSubmit={event => { event.preventDefault(); void search(); }}><Icon name="search" /><input role="combobox" aria-haspopup="dialog" aria-autocomplete="none" aria-label="Search free music" aria-expanded={focused} aria-controls="song-suggestions" placeholder="Song, artist, or a sound" value={query} maxLength={200} onFocus={() => void showSuggestions()} onPointerDown={() => void showSuggestions(true)} onChange={event => { const value = event.target.value; setQuery(value); setFocused(true); controller.current?.abort(); controller.current = undefined; suggestionController.current?.abort(); setSuggesting(false); if (!value.trim()) setTracks([]); setSearched(''); setBusy(value.trim().length >= 2); setMessage('Type a title or artist.'); clearTimeout(typingTimer.current); if (value.trim().length >= 2) typingTimer.current = setTimeout(() => void search(false, value), 250); }} onKeyDown={event => { if (event.key === 'ArrowDown' && focused) { event.preventDefault(); searchBox.current?.querySelector<HTMLButtonElement>('.song-suggestion, .catalog-track button[aria-label^="Stream"]')?.focus(); } }} required /><button aria-busy={busy}>{busy ? <span className="search-spinner" aria-label="Searching" /> : 'Search'}</button></form>
    {focused && <div id="song-suggestions" className="song-suggestions" role="dialog" aria-label="Song suggestions"><span className="suggestion-heading">{query.trim() ? 'Matching songs' : personal.length ? 'For you' : 'A little inspiration'}</span>
      {!query.trim() && taste.data.recent.length > 0 && <div className="recent-searches"><div><small>Recent</small><button aria-label="Clear recent searches" onClick={() => { if (updateTaste(localStorage, value => ({...value,recent:[]}))) announceTaste(); }}>Clear</button></div><div>{taste.data.recent.map(term => <button key={term} onClick={() => { setQuery(term); void search(false,term); }}>{term}</button>)}</div></div>}
      {taste.blocked && <small>Listening preferences could not be read. Saved data is preserved.</small>}
      {personal.length > 0 && !query.trim() && <div className="taste-note"><small>From your song choices ? on this device</small><button aria-label="Reset music recommendations" onClick={() => { if (updateTaste(localStorage,value=>({...value,listens:[]}))) announceTaste(); }}>Reset</button></div>}
      {suggesting && <p role="status">Finding your sound<span className="search-dots"><i /><i /><i /></span></p>}
      {suggestionError && <p>{suggestionError}</p>}
      {!searched && !busy && suggested.map(track => <button className="song-suggestion" key={track.id} onClick={() => select(track, suggested)}><TrackArtwork src={trackArtwork(track)} alternatives={artworkAlternatives(track)} title={songDisplay(track).title} /><span><strong title={`Original: ${track.title}; uploaded by ${track.user.name}`}>{songDisplay(track).title}</strong><small>{songDisplay(track).artist}</small></span><Icon name="play" size={15} /></button>)}
      {query.trim() && !busy && !searched && !suggested.length && <p>Search for a song or artist. Only matching tracks appear here.</p>}
    {(busy || searched || tracks.length > 0) && <div className="header-search-results"><div className="search-result-tabs" aria-label="Result type"><button aria-pressed={resultType==='songs'} onClick={()=>setResultType('songs')}>Songs</button><button aria-pressed={resultType==='artists'} onClick={()=>setResultType('artists')}>Artists</button></div><p className="song-result-label" role="status">{message}</p>
    {searched && tracks.length > 0 && <p className="catalog-search-help">{isPublicDemo ? 'Original demo recordings.' : 'Closest matches first. Community uploads; artist titles do not verify originals.'}</p>}
    {resultType==='artists' && <div className="search-artists">{artistGroups.map(group=><button key={group.artist} onClick={()=>{setResultType('songs');setQuery(group.artist);void search(false,group.artist);}}><TrackArtwork src={trackArtwork(group.tracks[0])} title={group.artist}/><span><strong>{group.artist}</strong><small>{group.tracks.length} matching uploads</small></span><span aria-hidden="true">&#8594;</span></button>)}</div>}
    {resultType==='songs' && <div ref={node=>{if(node)node.scrollTop=resultScroll.current;}} onScroll={event=>{resultScroll.current=event.currentTarget.scrollTop;}} className={`catalog-track-list ${busy ? 'catalog-loading' : ''}`} aria-busy={busy}>{busy && !tracks.length && Array.from({ length: 4 }, (_, index) => <div className="song-skeleton" key={index} aria-hidden="true"><i /><span><i /><i /></span></div>)}{tracks.slice(0, limit).map(track => <article className={`catalog-track ${selected === track.id ? 'song-selected' : ''} ${pendingTrack === `${musicProvider(track)}:${track.id}` ? 'song-pending' : ''}`} key={track.id} tabIndex={0} onPointerDown={event => { if (!(event.target as Element).closest('button, a, summary, details')) event.currentTarget.focus({ preventScroll: true }); }} onMouseDown={event => { if (!(event.target as Element).closest('button, a, summary, details')) event.preventDefault(); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(track, tracks); } }} onClick={event => { if (!(event.target as HTMLElement).closest('button, a, summary, details')) select(track, tracks); }} style={{ cursor: 'pointer', animationDelay: `${Math.min(tracks.indexOf(track), 8) * 35}ms` }}><TrackArtwork src={trackArtwork(track)} alternatives={artworkAlternatives(track)} title={songDisplay(track).title} /><div><strong title={`Original: ${track.title}; uploaded by ${track.user.name}`}>{songDisplay(track).title}</strong><small>{songDisplay(track).artist}<span className="track-provider">{musicProvider(track)}</span>{songDisplay(track).version !== 'Upload' && <span className="track-version">{songDisplay(track).version}</span>}</small>{track.sourceUrl && <details className="song-source"><summary>Details</summary><small>Uploaded by {track.user.name}</small><small><a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>{track.licenseUrl && <> / <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">License</a></>}</small></details>}</div>{track.duration != null && <time className="track-duration">{Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}</time>}<LikeButton track={track} /><button className="playlist-add" disabled={!!playlistError} aria-label={`Add ${songDisplay(track).title} to playlist`} onClick={() => { setAdding(track); setFocused(false); document.getElementById('catalog')?.scrollIntoView({ block: 'start' }); }}>+</button><button aria-label={`Stream ${songDisplay(track).title} by ${songDisplay(track).artist}`} onClick={() => select(track, tracks)}><>{pendingTrack === `${musicProvider(track)}:${track.id}` ? <span className="search-spinner" role="status" aria-label="Loading song" /> : <Icon name="play" size={17} />}</></button></article>)}</div>}
    {tracks.length > limit && <button className="catalog-more" onClick={() => setLimit(value => value + 12)}>Show more songs</button>}
    </div>}
      <div className="suggestion-moods">{['lofi', 'house', 'ambient', 'hip hop'].map(term => <button key={term} onClick={() => { setQuery(term); void search(false, term); }}>{term}</button>)}</div>
    </div>}
  </div>;
  return <div className="full-catalog" aria-label="Free music catalog">
    {dock ? createPortal(searchControl, dock) : searchControl}
    <PlaylistLibrary lists={lists} save={save} play={play} error={playlistError} />
    {!isPublicDemo && <JamendoDiscovery query={query} play={play} />}
    {playlistNotice && <p role="status">{playlistNotice}</p>}
    {adding && <div className="playlist-picker" role="dialog" aria-label="Add to playlist"><strong>Keep {songDisplay(adding).title}</strong>{lists.map(list => <button key={list.id} disabled={!!playlistError || list.tracks.length >= 50 || list.tracks.some(track => track.id === adding.id)} onClick={() => { try { const saved = save(lists.map(item => item.id === list.id ? { ...item, tracks: [...item.tracks, playlistTrack(adding)] } : item)); if (saved) setPlaylistNotice(`Added to ${list.name}`); setAdding(null); } catch { setPlaylistNotice('This song could not be saved.'); } }}>{list.name}</button>)}{!lists.length && <p>Create a playlist above first.</p>}<button onClick={() => setAdding(null)}>Cancel</button></div>}
    <p className="catalog-note">{isPublicDemo ? '18 original sketches. Saved music and preferences stay in this browser.' : 'Audio streams inside Tuniko. Only available streams from connected catalogs; imported music stays on your device.'}</p>
  </div>;
}
