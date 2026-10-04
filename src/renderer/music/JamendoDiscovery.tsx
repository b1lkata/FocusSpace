import { isCatalogUpload } from './audius';
import { songDisplay } from './songDisplay';
import { useEffect, useState } from 'react';
import { directJamendo } from './jamendoClient';
import { trackArtwork, type AudiusTrack } from './audius';
import { TrackArtwork } from './TrackArtwork';
import { playableTracks } from './streamAvailability';
import { isWebPreview } from '../runtime';

export function JamendoDiscovery({ query, play }: { query: string; play: (track: AudiusTrack, queue: AudiusTrack[]) => void }) {
  const [view, setView] = useState<'artist' | 'album' | 'songs'>('artist');
  const [scope, setScope] = useState<{ artistId?: string; albumId?: string; name: string }>();
  const [offset, setOffset] = useState(0);
  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [status, setStatus] = useState('');
  const [configured, setConfigured] = useState(false);
  const [more, setMore] = useState(false);
  const [client, setClient] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('Finding independent music…'); setTracks([]);
    const timer = setTimeout(() => {
      void directJamendo({ query: scope ? '' : query.trim().slice(0, 200), discover: scope ? true : !query.trim(), offset, ...(scope?.artistId ? { artistId: scope.artistId } : {}), ...(scope?.albumId ? { albumId: scope.albumId } : {}), ...(!scope && view !== 'songs' ? { group: view } : {}) }, controller.signal).then(async result => {
        if (controller.signal.aborted) return;
        setConfigured(result.configured); setMore(result.tracks.length === 24 && offset < 1992);
        const playable = scope || view === 'songs' ? await playableTracks(result.tracks, controller.signal) : result.tracks.filter(isCatalogUpload);
        if (controller.signal.aborted) return;
        setTracks(playable); setStatus(result.configured ? playable.length ? '' : 'No matches here. Try another artist or album.' : 'Connect Jamendo to discover more independent artists and albums.');
      }).catch(() => { if (!controller.signal.aborted) setStatus('Jamendo could not connect. Please try again.'); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, view, scope, offset, revision]);
  async function connect() {
    const reply = await window.focusspace.call({ type: 'jamendo-client', clientId: client.trim() });
    if (!reply.ok) { setStatus(reply.error); return; }
    setClient(''); setRevision(value => value + 1);
  }
  return <section className="jamendo-discovery" aria-label="Jamendo artists and albums">
    <div className="jamendo-heading"><div><small>INDEPENDENT DISCOVERY</small><h2>{scope?.name ?? 'A world beyond the familiar.'}</h2></div>{scope && <button onClick={() => { setScope(undefined); setOffset(0); }}>Back to discovery</button>}</div>
    {!scope && <div className="suggestion-moods" aria-label="Browse Jamendo">{(['artist', 'album', 'songs'] as const).map(tab => <button key={tab} aria-pressed={view === tab} onClick={() => { setView(tab); setOffset(0); }}>{tab === 'artist' ? 'Artists' : tab === 'album' ? 'Albums' : 'Songs'}</button>)}</div>}
    {status && <p role="status">{status}</p>}
    <div className="jamendo-grid">{tracks.map(track => <button key={track.id} className="jamendo-card" onClick={() => {
      if (!scope && view !== 'songs') { setScope(view === 'artist' ? { artistId: track.artistId, name: track.user.name } : { albumId: track.albumId, name: track.albumName ?? track.title }); setOffset(0); }
      else play(track, tracks);
    }}><TrackArtwork src={trackArtwork(track)} title={songDisplay(track).title} /><strong>{!scope && view === 'artist' ? track.user.name : !scope && view === 'album' ? track.albumName ?? songDisplay(track).title : songDisplay(track).title}</strong><span>{!scope && view === 'artist' ? 'Explore artist' : songDisplay(track).artist}</span></button>)}</div>
    <div className="jamendo-pages">{offset > 0 && <button onClick={() => setOffset(value => Math.max(0, value - 24))}>Previous</button>}{more && <button onClick={() => setOffset(value => value + 24)}>Next</button>}</div>
    {!isWebPreview && <details><summary>{configured ? 'Jamendo connection' : 'Connect Jamendo'}</summary><p>Use the client ID from your Jamendo developer account. It is saved encrypted on this computer.</p><label>Client ID<input type="password" value={client} autoComplete="off" maxLength={128} onChange={event => setClient(event.target.value)} /></label><button disabled={!/^[a-zA-Z0-9_-]{4,128}$/.test(client.trim())} onClick={() => void connect()}>Connect</button><button onClick={() => { void window.focusspace.call({ type: 'jamendo-client', clientId: '' }).then(reply => { if (reply.ok) setRevision(value => value + 1); else setStatus(reply.error); }); }}>Remove saved ID</button></details>}
  </section>;
}
