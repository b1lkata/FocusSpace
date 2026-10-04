import { isCatalogUpload } from './audius';
import { songDisplay } from './songDisplay';
import { useState } from 'react';
import type { AudiusTrack } from './audius';
import { artworkAlternatives, trackArtwork } from './audius';
import { musicProvider } from './providers';
import { TrackArtwork } from './TrackArtwork';
import { playlistColors, type Playlist } from './playlists';

export function PlaylistLibrary({ lists, save, play, error }: { lists: Playlist[]; save: (lists: Playlist[]) => void; play: (track: AudiusTrack, queue: AudiusTrack[]) => void; error: string }) {
  const [active, setActive] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const current = lists.find(list => list.id === active);
  function update(patch: Partial<Playlist>) { if (current) save(lists.map(list => list.id === current.id ? { ...list, ...patch } : list)); }
  return <section className="playlist-library" aria-label="Your playlists">
    <div className="music-section-title"><div><span className="music-eyebrow">MADE BY YOU</span><h2>Your rotation.</h2></div><button className="artist-filter" disabled={!!error || lists.length >= 24} onClick={() => setCreating(value => !value)}>New playlist</button></div>
    {error && <p role="alert">{error}</p>}
    {creating && <form className="playlist-create" onSubmit={event => { event.preventDefault(); const id = crypto.randomUUID(); save([...lists, { id, name: name.trim(), color: 'lilac', tracks: [] }]); setActive(id); setCreating(false); setName(''); }}><input autoFocus aria-label="New playlist name" placeholder="Give it a name" value={name} maxLength={60} onChange={event => setName(event.target.value)} required /><button disabled={!name.trim()}>Create</button></form>}
    {!lists.length && !error && <p className="playlist-empty">A home for your favorites. Create a playlist, then add songs from search.</p>}
    <div className="playlist-grid">{lists.map(list => <button className={`playlist-card playlist-${list.color} ${active === list.id ? 'playlist-active' : ''}`} key={list.id} aria-pressed={active === list.id} onClick={() => setActive(active === list.id ? '' : list.id)}><span className="playlist-cover">{list.tracks.filter(isCatalogUpload).length ? <TrackArtwork src={trackArtwork(list.tracks.find(isCatalogUpload)!)} alternatives={artworkAlternatives(list.tracks.find(isCatalogUpload)!)} title={list.name} /> : <span aria-hidden="true">♫</span>}</span><strong>{list.name}</strong><small>{list.tracks.filter(isCatalogUpload).length} songs</small></button>)}</div>
    {current && <div className="playlist-detail">
      <div className="playlist-tools"><input aria-label="Playlist name" value={current.name} maxLength={60} disabled={!!error} onChange={event => { if (event.target.value.trim()) update({ name: event.target.value }); }} /><select aria-label="Playlist color" value={current.color} disabled={!!error} onChange={event => update({ color: event.target.value as Playlist['color'] })}>{playlistColors.map(color => <option key={color}>{color}</option>)}</select><button disabled={!current.tracks.some(isCatalogUpload)} onClick={() => play(current.tracks.filter(isCatalogUpload)[0], current.tracks.filter(isCatalogUpload))}>Play playlist</button><button disabled={!!error} onClick={() => { save(lists.filter(list => list.id !== current.id)); setActive(''); }}>Delete playlist</button></div>
      {!current.tracks.some(isCatalogUpload) && <p className="playlist-empty">Find a song above. Tap + to keep it here.</p>}
      {current.tracks.map((track, index) => isCatalogUpload(track) ? <div className="playlist-song" key={track.id}><TrackArtwork src={trackArtwork(track)} alternatives={artworkAlternatives(track)} title={songDisplay(track).title} /><button className="playlist-song-title" onClick={() => play(track, current.tracks)}><strong title={`Original: ${track.title}; uploaded by ${track.user.name}`}>{songDisplay(track).title}</strong><small>{songDisplay(track).artist} &middot; {musicProvider(track)}{songDisplay(track).version !== 'Upload' && <> &middot; {songDisplay(track).version}</>}</small></button>{track.sourceUrl && <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}{track.licenseUrl && <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">License</a>}<button aria-label={`Move ${songDisplay(track).title} up`} disabled={!current.tracks.slice(0, index).some(isCatalogUpload) || !!error} onClick={() => { const tracks = [...current.tracks]; let previous = index - 1; while (previous >= 0 && !isCatalogUpload(tracks[previous])) previous--; if (previous >= 0) { [tracks[previous], tracks[index]] = [tracks[index], tracks[previous]]; update({ tracks }); } }}>↑</button><button aria-label={`Remove ${songDisplay(track).title}`} disabled={!!error} onClick={() => update({ tracks: current.tracks.filter(item => item.id !== track.id) })}>×</button></div> : null)}
    </div>}
  </section>;
}
