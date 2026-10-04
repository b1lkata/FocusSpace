import { nextRepeat, shuffledUpcoming, endedIndex, type RepeatMode } from './playbackOptions';
import { LikeButton, songIdentity } from './likedSongs';
import { rememberListen, rememberListeningTime, announceTaste } from './listeningTaste';
import { isCatalogUpload } from './audius';
import { songDisplay, capitalizeSong } from './songDisplay';
import { useEffect, useImperativeHandle, useRef, useState, type Ref, type CSSProperties } from 'react';
import { Icon } from '../design/Icon';
import { createPortal } from 'react-dom';
import { usePhoneLayout } from './usePhoneLayout';
import { usePlayerDismiss } from './usePlayerDismiss';
import { matchesCatalog, readAudioFiles, writeAudioFiles, type AudioFile } from './audioFiles';

import { trackArtwork, artworkAlternatives, type AudiusTrack } from './audius';
import { TrackArtwork } from './TrackArtwork';
import { LyricsPanel } from './LyricsPanel';
import { SongShare } from './SongShare';
import { publicSongUrl } from './shareCard';
import { songColor } from './songTheme';
import { musicStream, musicProvider } from './providers';
import { markUnavailable, isUnavailable } from './streamAvailability';
import { nativeAudio, nativeTracks, usesNativeAudio, audioBase64 } from './nativeAudio';
import type { CatalogTrack } from './catalogSearch';
export type AudioControls = { playCatalog: (track: CatalogTrack) => void; playAudius: (track: AudiusTrack, queue: AudiusTrack[]) => void };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function AudioLibrary({ inactive, onPlay, control, onFiles, onPlaybackChange }: { inactive: boolean; onPlay: () => void; control?: Ref<AudioControls>; onFiles?: (files: AudioFile[]) => void; onPlaybackChange?: (playing: boolean) => void }) {
  const phone = usePhoneLayout();
  const [playerOpen, setPlayerOpen] = useState(false);
  const playerDialog = useRef<HTMLDialogElement>(null);
  const miniTrigger = useRef<HTMLButtonElement>(null);
  const dismissPlayer = usePlayerDismiss(playerDialog);
  useEffect(() => { if (phone && playerOpen) playerDialog.current?.showModal(); else playerDialog.current?.close(); }, [phone, playerOpen]);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [active, setActive] = useState('');
  const [remote, setRemote] = useState<AudiusTrack>();
  const [loadingSong, setLoadingSong] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(sleepTimer.current), []);
  const [queueEditing, setQueueEditing] = useState(false);
  const [queue, setQueue] = useState<AudiusTrack[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  const listeningSample = useRef<{id:string;time:number;seconds:number}>({id:'',time:0,seconds:0});
  useEffect(() => { if(!remote)return;const id=songIdentity(remote), sample=listeningSample.current;if(sample.id!==id){listeningSample.current={id,time,seconds:0};return;}const delta=time-sample.time;sample.time=time;if(!playing||delta<=0||delta>2)return;sample.seconds+=delta;if(sample.seconds>=30){sample.seconds-=30;if(rememberListeningTime(localStorage,remote))announceTaste();} }, [time,playing,remote]);
  const [duration, setDuration] = useState(0);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [theme, setTheme] = useState('auto');
  const [artColor, setArtColor] = useState<string>();
  const [volume, setVolume] = useState(.65);
  const audio = useRef<HTMLAudioElement>(null);
  const playbackGeneration = useRef(0);
  const nativeQueue = useRef<AudiusTrack[]>([]);
  const reportNativeError = () => setError('Audio could not respond. Try selecting the song again.');
  function pauseAudio() { if (usesNativeAudio) void nativeAudio.pause().catch(reportNativeError); else audio.current?.pause(); }
  async function resumeAudio() { onPlay(); if (usesNativeAudio) await nativeAudio.resume(); else await audio.current?.play(); }
  const picker = useRef<HTMLInputElement>(null);
  const pending = useRef<CatalogTrack | undefined>(undefined);
  useEffect(() => { onFiles?.(files); }, [files, onFiles]);
  useImperativeHandle(control, () => ({ playAudius(track, tracks) { if (!isCatalogUpload(track)) return; tracks = tracks.filter(item => isCatalogUpload(item) && !isUnavailable(item)); if (tracks.length > 50) tracks = [track, ...tracks.filter(item => songIdentity(item) !== songIdentity(track))].slice(0,50); setQueue(tracks); nativeQueue.current = tracks; if (remote?.id === track.id) { if (playing) pauseAudio(); else void resumeAudio().catch(reportNativeError); } else void stream(track); }, playCatalog(track) { const found = files.find(file => matchesCatalog(file, track)); if (found) void start(found); else if (!busy && !blocked) { pending.current = track; picker.current?.click(); } } }));
  useEffect(() => { onPlaybackChange?.(playing); }, [playing, onPlaybackChange]);
  const objectUrl = useRef('');
  const current = remote ? { name: `${songDisplay(remote).artist} - ${songDisplay(remote).title}` } : files.find(file => file.id === active);
  useEffect(() => {
    setArtColor(undefined);
    if (!remote || !trackArtwork(remote)) return;
    let cancelled = false;
    const image = new Image(); image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
    image.onload = () => { if (cancelled) return; try { const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8; const context = canvas.getContext('2d'); if (!context) return; context.drawImage(image, 0, 0, 8, 8); const pixels = context.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < pixels.length; i += 4) { r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; } setArtColor(`rgb(${Math.round(r / 64)}, ${Math.round(g / 64)}, ${Math.round(b / 64)})`); } catch { /* Provider CORS can prevent color sampling; use the song palette. */ } };
    const sources = artworkAlternatives(remote); let attempt = 0;
    image.onerror = () => { if (!cancelled && ++attempt < sources.length) image.src = sources[attempt]; };
    image.src = sources[0];
    return () => { cancelled = true; image.onload = null; image.onerror = null; image.src = ''; };
  }, [remote?.id]);
  useEffect(() => {
    let mounted = true;
    void readAudioFiles().then(value => { if (mounted) setFiles(value); }).catch(() => { if (mounted) { setBlocked(true); setError('Your audio library could not be read. The saved copy is preserved.'); } }).finally(() => { if (mounted) setBusy(false); });
    const element = audio.current;
    const receive = (state: import('./nativeAudio').NativePlayback) => {
      if (!mounted) return; setPlaying(state.playing); setTime(state.time); setDuration(state.duration);
      if (state.local) { setRemote(undefined); setActive(state.id); } else { const song = nativeQueue.current.find(track => track.id === state.id); if (song) { setRemote(song); setActive(''); } }
      if (state.sleepActive === false) setSleepMinutes(0);
      if (state.error) { setLoadingSong(false); setError(state.error); const failed = nativeQueue.current.find(track => track.id === state.id); if (!state.local && failed) markUnavailable(failed); }
    };
    const hide = () => { if (document.hidden && !usesNativeAudio) element?.pause(); else if (!document.hidden && usesNativeAudio) void nativeAudio.state().then(receive).catch(reportNativeError); };
    const subscription = usesNativeAudio ? nativeAudio.addListener('playback', receive).catch(() => { if (mounted) reportNativeError(); }) : undefined;
    document.addEventListener('visibilitychange', hide);
    return () => { mounted = false; playbackGeneration.current += 1; if (usesNativeAudio) { void nativeAudio.stop().catch(() => {}); void subscription?.then(handle => handle?.remove()); } document.removeEventListener('visibilitychange', hide); element?.pause(); onPlaybackChange?.(false); element?.removeAttribute('src'); element?.load(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); };
  }, []);
  useEffect(() => { if (inactive) pauseAudio(); }, [inactive]);
  async function start(file: AudioFile) {
    const generation = ++playbackGeneration.current;
    const element = audio.current; if (!element) return;
    pauseAudio(); setRemote(undefined); setQueue([]); nativeQueue.current = [];
    if (usesNativeAudio) { setActive(file.id); setTime(0); setDuration(0); setError(''); onPlay(); try { const mimeExtensions: Record<string, string> = { 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/x-flac': 'flac', 'audio/ogg': 'ogg', 'audio/flac': 'flac' }; const data = await audioBase64(file.blob); if (generation !== playbackGeneration.current) return; await nativeAudio.playLocal({ id: file.id, title: capitalizeSong(file.name), data, extension: mimeExtensions[file.blob.type] ?? 'mp3', volume }); } catch { reportNativeError(); } return; }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file.blob); element.src = objectUrl.current; element.volume = volume;
    setActive(file.id); setTime(0); setDuration(0); setError(''); onPlay();
    try { await element.play(); } catch { setError('This file could not play. Try a supported MP3 or WAV file.'); }
  }
  async function stream(track: AudiusTrack) {
    if (!isCatalogUpload(track)) return;
    const generation = ++playbackGeneration.current;
    const element = audio.current; if (!element) return;
    pauseAudio(); if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; }
    setLoadingSong(true); window.dispatchEvent(new CustomEvent('tuniko-playback-pending', { detail: `${musicProvider(track)}:${track.id}` }));
    setRemote(track); setActive(''); setTime(0); setDuration(0); setError(''); if (!usesNativeAudio) element.src = musicStream(track); element.volume = volume; onPlay();
    if (usesNativeAudio) { try { const tracks = nativeQueue.current.length ? nativeQueue.current : [track]; await nativeAudio.play({ tracks: nativeTracks(tracks), index: Math.max(0, tracks.findIndex(value => value.id === track.id)), volume }); if (generation === playbackGeneration.current && rememberListen(localStorage,track)) announceTaste(); } catch { if (generation === playbackGeneration.current) { markUnavailable(track); reportNativeError(); } } finally { if (generation === playbackGeneration.current) { setLoadingSong(false); window.dispatchEvent(new CustomEvent('tuniko-playback-pending', { detail: '' })); } } return; }
    try { await element.play(); if (generation === playbackGeneration.current && rememberListen(localStorage,track)) announceTaste(); } catch (error) { if (generation !== playbackGeneration.current) return; if (error instanceof DOMException && ['AbortError', 'NotAllowedError'].includes(error.name)) return; markUnavailable(track); setError('This stream is unavailable and has been hidden from the catalog.'); } finally { if (generation === playbackGeneration.current) { setLoadingSong(false); window.dispatchEvent(new CustomEvent('tuniko-playback-pending', { detail: '' })); } }
  }
  function step(delta: number, wrap = true) {
    if (remote && usesNativeAudio) { void nativeAudio.skip({ delta }).catch(reportNativeError); return; }
    if (remote) { const available = queue.filter(track => !isUnavailable(track)); const index = available.findIndex(track => track.id === remote.id); const next = index + delta; if (available.length && (wrap || (next >= 0 && next < available.length))) void stream(available[(next + available.length) % available.length]); return; }
    const index = files.findIndex(file => file.id === active); const next = index + delta;
    if (!files.length || (!wrap && next >= files.length)) return;
    void start(files[(next + files.length) % files.length]);
  }
  async function importFiles(selected: FileList | null) {
    if (!selected || blocked || busy) return;
    const linked = pending.current; pending.current = undefined;
    const imported = Array.from(selected);
    if (files.length + imported.length > 200 || imported.some(file => !/\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name) || file.size > 50 * 1024 * 1024 || file.size === 0)) { setError('Choose audio files up to 50 MB each. Your library can hold 200 tracks.'); return; }
    const items = imported.map((blob, index) => ({ id: crypto.randomUUID(), name: linked && index === 0 ? `${linked.artistName} - ${linked.trackName}` : blob.name.replace(/\.[^.]+$/, ''), blob, ...(linked && index === 0 ? { catalogId: linked.trackId } : {}) }));
    setBusy(true);
    try { await writeAudioFiles(items); setFiles(previous => [...previous, ...items]); setError(''); if (linked && items[0]) void start(items[0]); } catch { setError('These files could not be saved. Your existing tracks are preserved.'); } finally { setBusy(false); }
  }
  async function remove(file: AudioFile) {
    setBusy(true);
    try {
      await writeAudioFiles([], file.id);
      if (active === file.id) { playbackGeneration.current += 1; if (usesNativeAudio) void nativeAudio.stop().catch(reportNativeError); audio.current?.pause(); audio.current?.removeAttribute('src'); audio.current?.load(); URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; setActive(''); setTime(0); setDuration(0); }
      setFiles(previous => previous.filter(item => item.id !== file.id)); setError('');
    } catch { setError('This track could not be removed. Your library is preserved.'); } finally { setBusy(false); }
  }
  async function changeRepeat() { const next=nextRepeat(repeat); try { if(usesNativeAudio) await nativeAudio.playbackOptions({repeat:next});setRepeat(next); }catch{reportNativeError();} }
  async function changeSleep(minutes:number) { try { if(usesNativeAudio)await nativeAudio.playbackOptions({sleepMinutes:minutes});clearTimeout(sleepTimer.current);setSleepMinutes(minutes);if(minutes&&!usesNativeAudio)sleepTimer.current=setTimeout(()=>{pauseAudio();setSleepMinutes(0);},minutes*60_000); }catch{reportNativeError();} }
  async function shuffleQueue() { if(queueEditing||!remote)return; const index=queue.findIndex(track=>songIdentity(track)===songIdentity(remote));const changed=shuffledUpcoming(queue,index);setQueueEditing(true);try{if(usesNativeAudio)await nativeAudio.reorderQueue({order:changed.map(track=>queue.indexOf(track))});nativeQueue.current=changed;setQueue(changed);}catch{setError('Queue could not shuffle. Your current song keeps playing.');}finally{setQueueEditing(false);} }
  function finishTrack() { const index=remote?queue.findIndex(track=>songIdentity(track)===songIdentity(remote)):files.findIndex(file=>file.id===active);const next=endedIndex(index,remote?queue.length:files.length,repeat);setPlaying(false);if(next>=0){if(remote)void stream(queue[next]);else void start(files[next]);} }
  async function editQueue(from: number, to?: number) {
    if (queueEditing || !remote) return;
    const currentIndex = queue.findIndex(track => songIdentity(track) === songIdentity(remote));
    if (from <= currentIndex || from >= queue.length || (to != null && (to <= currentIndex || to >= queue.length))) return;
    const changed = [...queue]; const [item] = changed.splice(from,1); if (to != null) changed.splice(to,0,item);
    setQueueEditing(true);
    try { if (usesNativeAudio) await nativeAudio.editQueue({from,to}); nativeQueue.current=changed; setQueue(changed); }
    catch { setError('Queue could not change. Your current song keeps playing.'); }
    finally { setQueueEditing(false); }
  }
  const songAccent = theme === 'auto' ? artColor ?? songColor(current?.name ?? 'Tuniko') : ({ velvet: '#b8a2e3', ocean: '#91c8c1', ember: '#e4a185' }[theme] ?? '#b8a2e3');
  const playerBody = <div className="player-content" style={{ '--song-color': songAccent } as CSSProperties}>
    <div className="audio-deck" style={{ '--song-color': songAccent } as CSSProperties}><div className="audio-record" aria-hidden="true"><i />{remote ? <TrackArtwork src={trackArtwork(remote)} alternatives={artworkAlternatives(remote)} title={songDisplay(remote).title} /> : <span>TU</span>}</div><div className="audio-current"><span className="music-eyebrow">{loadingSong ? 'LOADING SONG' : playing ? 'NOW PLAYING' : remote ? 'MUSIC STREAM' : 'ON YOUR DEVICE'}</span><strong>{remote ? songDisplay(remote).title : (current ? capitalizeSong(current.name) : 'Make room for your favorites.')}</strong><small>{remote ? songDisplay(remote).artist : current ? 'On your device' : 'Find a song above. Stay awhile.'}</small><div className="audio-transport"><button aria-label="Previous audio track" disabled={!files.length && !remote} onClick={() => step(-1)}>&#8249;</button><button className="audio-main-play" aria-label={remote ? playing ? 'Pause Audius audio' : 'Play Audius audio' : playing ? 'Pause local audio' : 'Play local audio'} disabled={!files.length && !remote} onClick={() => { if (playing) pauseAudio(); else if (current && audio.current) { void resumeAudio().catch(() => setError('Audio could not resume. Try selecting the track again.')); } else if (files[0]) void start(files[0]); }}><Icon name={playing ? 'pause' : 'play'} /></button><button aria-label="Next audio track" disabled={!files.length && !remote} onClick={() => step(1)}>&#8250;</button></div><div className="audio-progress"><span>{clock(time)}</span><input aria-label="Audio position" type="range" min="0" max={duration || 1} step=".1" value={Math.min(time, duration || 1)} disabled={!duration} onChange={event => { if (audio.current) { if (usesNativeAudio) void nativeAudio.seek({ time: Number(event.target.value) }).catch(reportNativeError); else audio.current.currentTime = Number(event.target.value); setTime(Number(event.target.value)); } }} /><span>{clock(duration)}</span></div></div><span className="song-motion" aria-hidden="true"><i /><i /><i /><i /><i /></span><label className="audio-volume">Volume<input aria-label="Local audio volume" type="range" min="0" max="1" step=".01" value={volume} onChange={event => { const value = Number(event.target.value); setVolume(value); if (usesNativeAudio) void nativeAudio.volume({ volume: value }).catch(reportNativeError); else if (audio.current) audio.current.volume = value; }} /></label></div>
    <div className="player-options"><button aria-label="Shuffle upcoming songs" disabled={!remote||queueEditing||queue.length<3} onClick={()=>void shuffleQueue()}>Shuffle</button><button aria-label={`Repeat ${repeat}`} aria-pressed={repeat!=='off'} onClick={()=>void changeRepeat()}>Repeat {repeat==='one'?'1':repeat==='all'?'all':'off'}</button><label>Sleep<select aria-label="Sleep timer" value={sleepMinutes} onChange={event=>void changeSleep(Number(event.target.value))}><option value={0}>Off</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 hour</option></select></label></div>
    <button className="lyrics-toggle" disabled={!current} aria-expanded={lyricsOpen} onClick={() => setLyricsOpen(value => !value)}>Lyrics</button>
    {current && <SongShare key={remote?.id ?? active} song={{ title: (remote ? songDisplay(remote).title : undefined) ?? (current.name.split(' - ').slice(1).join(' - ') || current.name), artist: (remote ? songDisplay(remote).artist : undefined) ?? (current.name.includes(' - ') ? current.name.split(' - ')[0] : ''), artwork: remote ? trackArtwork(remote) : undefined, alternatives: remote ? artworkAlternatives(remote) : [], url: remote ? publicSongUrl(remote) : undefined, provider: remote ? musicProvider(remote) : undefined, license: remote?.licenseUrl, color: songAccent }} />}
    {lyricsOpen && current && <LyricsPanel key={remote?.id ?? active} identity={remote?.id ?? active} title={(remote ? songDisplay(remote).title : undefined) ?? (current.name.split(' - ').slice(1).join(' - ') || current.name)} artist={(remote ? songDisplay(remote).artist : undefined) ?? (current.name.includes(' - ') ? current.name.split(' - ')[0] : '')} duration={remote?.duration ?? (duration || undefined)} time={time} color={songAccent} seek={value => { if (usesNativeAudio) void nativeAudio.seek({ time: value }).catch(reportNativeError); else if (audio.current) audio.current.currentTime = value; }} />}
    {remote && <LikeButton track={remote} />}
    {remote && queue.length > 0 && <details className="playback-queue"><summary>Up next</summary>{queue.slice(queue.findIndex(track=>songIdentity(track)===songIdentity(remote))+1).map(track=>{const index=queue.indexOf(track),currentIndex=queue.findIndex(item=>songIdentity(item)===songIdentity(remote));return <div className="queue-song" key={songIdentity(track)}><span><strong>{songDisplay(track).title}</strong><small>{songDisplay(track).artist}</small></span><button aria-label={`Move ${songDisplay(track).title} earlier`} disabled={queueEditing||index===currentIndex+1} onClick={()=>void editQueue(index,index-1)}>&#8593;</button><button aria-label={`Move ${songDisplay(track).title} later`} disabled={queueEditing||index===queue.length-1} onClick={()=>void editQueue(index,index+1)}>&#8595;</button><button aria-label={`Remove ${songDisplay(track).title} from queue`} disabled={queueEditing} onClick={()=>void editQueue(index)}>&#215;</button></div>})}{queue.findIndex(track=>songIdentity(track)===songIdentity(remote))===queue.length-1&&<p>You're at the end of this queue.</p>}</details>}
    <details className="player-appearance"><summary>Appearance &amp; details</summary>{remote && <p className="player-source">{musicProvider(remote)} ? {songDisplay(remote).version} ? Uploaded by {remote.user.name}</p>}<label className="player-theme">Player theme<select aria-label="Player theme" value={theme} onChange={event => setTheme(event.target.value)}><option value="auto">Follow the song</option><option value="velvet">Velvet</option><option value="ocean">Ocean</option><option value="ember">Ember</option></select></label></details>
  </div>;
  return <section data-has-track={!!current} className={`audio-library ${playing ? 'audio-is-playing' : ''}`} aria-label="Your audio library">
    <div className="music-section-title"><div><span className="music-eyebrow">JUST THE MUSIC</span><h2>Your own rotation.</h2></div><input hidden ref={picker} aria-label="Import audio files" type="file" accept=".mp3,.wav,.m4a,.ogg,.flac" multiple disabled={busy || blocked} onChange={event => { void importFiles(event.target.files); event.target.value = ''; }} /></div>
    <audio ref={audio} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={finishTrack} onWaiting={() => setLoadingSong(true)} onPlaying={() => setLoadingSong(false)} onCanPlay={() => setLoadingSong(false)} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onDurationChange={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onError={() => { setLoadingSong(false); window.dispatchEvent(new CustomEvent('tuniko-playback-pending',{detail:''})); if (remote && audio.current?.currentSrc === musicStream(remote)) { markUnavailable(remote); setError('This stream is unavailable and has been hidden from the catalog.'); } else if (active) setError('This file could not play. Try a supported MP3 or WAV file.'); }} />
    {!phone && playerBody}
    {phone && createPortal(<><div className="phone-mini-player" style={{ '--song-color': songAccent } as CSSProperties}><button ref={miniTrigger} className="mini-song" aria-label={current ? "Open full player" : "Find a song"} onClick={() => { if (current) setPlayerOpen(true); else document.querySelector<HTMLInputElement>("#catalog-search-form input")?.focus(); }}>{remote ? <TrackArtwork src={trackArtwork(remote)} alternatives={artworkAlternatives(remote)} title={songDisplay(remote).title} /> : <Icon name="music" />}<span><strong>{remote ? songDisplay(remote).title : (current ? capitalizeSong(current.name) : 'Find your next favorite')}</strong><small>{loadingSong ? 'Loading song...' : remote ? songDisplay(remote).artist : current ? 'Tap for lyrics and sharing' : 'Your listening room is ready'}</small></span></button><button className="mini-play" aria-label={playing ? 'Pause mini player' : 'Play mini player'} disabled={!current} onClick={() => { if (playing) pauseAudio(); else void resumeAudio().catch(reportNativeError); }}><Icon name={playing ? 'pause' : 'play'} /></button></div><dialog ref={playerDialog} {...dismissPlayer} className="phone-full-player" aria-label="Now playing" onClose={() => { setPlayerOpen(false); requestAnimationFrame(() => miniTrigger.current?.focus({ preventScroll: true })); }}><header data-player-drag><span className="player-grab" aria-hidden="true" /><span className="music-eyebrow">YOUR ROTATION</span><button aria-label="Close full player" onClick={() => playerDialog.current?.close()}>⌄</button></header>{playerOpen && playerBody}{error && <div className="playback-error"><p role="alert" className="music-error">{error}</p>{remote && <button onClick={()=>void stream(remote)}>Retry song</button>}</div>}</dialog></>, document.body)}
    {error && <p className="music-error" role="alert">{error}</p>}
    <div className="audio-track-list">{files.map((file, index) => <article key={file.id} className={file.id === active ? 'audio-active-track' : ''}><button aria-label={`Play audio ${file.name}`} onClick={() => void start(file)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{capitalizeSong(file.name)}</strong><Icon name="play" size={14} /></button><button aria-label={`Remove audio ${file.name}`} disabled={busy || blocked} onClick={() => void remove(file)}>&#215;</button></article>)}</div>
    <p className="catalog-note">{remote ? `Streaming from ${musicProvider(remote)}. Your imported files stay on this device.` : 'Your imported music stays on this device.'}</p>
  </section>;
}
