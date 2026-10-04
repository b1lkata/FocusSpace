import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../design/Icon';
import '../design/typography.css';
import { isWebPreview, isPublicDemo } from '../runtime';
import { call } from '../api';
import { normalizeUrl } from '../../shared/model';
import type { BrowserState } from '../../shared/bridge';
import { moods } from './catalog';
import { AmbientAudio } from './AmbientAudio';
import { Companion } from './Companion';
import { initialMusicPreferences, musicPreferenceKey, musicPreferences, readMusicPreferences, type MusicPreferences } from './preferences';
import './music.css';
import './discovery.css';
import './audio.css';
import './polish.css';
import { SongDiscovery } from './SongDiscovery';
import { ListeningRoom, RoomControls } from './ListeningRoom';
import { PhoneNavigation } from './PhoneNavigation';
import './phone.css';
import './interaction.css';
import './musicFirst.css';

export function MusicApp() {
  const modernDesign=new URLSearchParams(location.search).get('design')!=='classic';
  useEffect(()=>{document.body.classList.toggle('tuniko-music-first',modernDesign);return()=>document.body.classList.remove('tuniko-music-first');},[modernDesign]);
  const [loaded] = useState(() => { try { return { preferences: readMusicPreferences(localStorage), error: '' }; } catch { return { preferences: initialMusicPreferences, error: 'Your listening preferences could not be read. The saved copy has been preserved.' }; } });
  const [preferences, setPreferences] = useState(loaded.preferences);
  const [error, setError] = useState(loaded.error);
  const [roomVisible, setRoomVisible] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [songPlaying, setSongPlaying] = useState(false);
  const [buddyHidden, setBuddyHidden] = useState(false);
  const [still, setStill] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => { const update=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update); }, []);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [greeting, setGreeting] = useState('Good sounds. Good company.');
  const [query, setQuery] = useState('');
  const [browser, setBrowser] = useState<BrowserState>();
  const [address, setAddress] = useState('');
  useEffect(() => { const hero = document.querySelector('.music-hero'); if (!hero) return; const observer = new IntersectionObserver(([entry]) => setRoomVisible(entry.isIntersecting), { threshold: .05 }); observer.observe(hero); return () => observer.disconnect(); }, [browser?.cardId]);
  const host = useRef<HTMLDivElement>(null);
  const audio = useRef(new AmbientAudio());
  const mood = moods.find(value => value.id === preferences.mood)!;
  function update(value: Partial<MusicPreferences>) {
    if (loaded.error) { setError(loaded.error); return; }
    const next = musicPreferences.safeParse({ ...preferences, ...value });
    if (!next.success) { setError('Use a name from 1 to 24 characters.'); return; }
    try { localStorage.setItem(musicPreferenceKey, JSON.stringify(next.data)); setPreferences(next.data); setError(''); } catch { setError('Your changes could not be saved. The previous copy is preserved.'); }
  }
  function stop() { audio.current.stop(); setPlaying(false); }
  async function play() {
    if (playing) { stop(); return; }
    try { await audio.current.play(mood.frequencies, preferences.volume); setPlaying(true); setGreeting('Oh, this one feels nice.'); } catch { stop(); setError('Sound could not start. Try the play button again.'); }
  }
  async function choose(id: MusicPreferences['mood']) {
    update({ mood: id }); setGreeting(id === 'glow' ? 'A little sunshine? Yes, please.' : id === 'afterhours' ? 'Just us and the late-night glow.' : 'Let’s take the scenic route.');
    if (playing) { try { await audio.current.play(moods.find(value => value.id === id)!.frequencies, preferences.volume); } catch { stop(); setError('Sound could not restart.'); } }
  }
  function hello() { update({ affection: Math.min(10000, preferences.affection + 1) }); setGreeting(preferences.affection >= 4 ? 'You’re becoming my favorite listening partner.' : preferences.personality === 'playful' ? 'Tiny dance break?' : preferences.personality === 'gentle' ? 'Happy to sit here with you.' : 'What shall we discover next?'); }
  async function open(url: string) {
    try {
      const safe = normalizeUrl(url); stop();
      if (isWebPreview) { window.open(safe, '_blank', 'noopener,noreferrer'); setGreeting('A new sound, a new little adventure.'); }
      else await call({ type: 'browse', url: safe });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'This page could not be opened.'); }
  }
  async function close() { try { await call({ type: 'browser', action: 'close' }); setBrowser(undefined); } catch { setError('The browser could not close. Try again.'); } }
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    const hide = () => { if (document.hidden) { audio.current.stop(); setPlaying(false); } };
    document.addEventListener('visibilitychange', hide);
    const unsubscribe = window.focusspace?.subscribe(event => { if (event.type === 'browser') { setBrowser(event.state); setAddress(event.state.url); } if (event.type === 'notice' && event.message === 'Return to workspace') setBrowser(undefined); });
    return () => { media.removeEventListener('change', change); document.removeEventListener('visibilitychange', hide); unsubscribe?.(); audio.current.stop(); };
  }, []);
  useEffect(() => {
    if (!browser || !host.current) return;
    const element = host.current;
    const bounds = () => { const rect = element.getBoundingClientRect(); void call({ type: 'bounds', rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } }); };
    const observer = new ResizeObserver(bounds); observer.observe(element); bounds(); return () => observer.disconnect();
  }, [browser?.cardId]);
  return <div className={`music-app ${modernDesign ? 'music-first' : ''} ${playing || songPlaying ? 'is-playing' : ''} ${still || reduced || hidden ? 'is-still' : ''} room-theme-${preferences.room} ${roomVisible ? '' : 'phone-room-away'}`} style={{ '--music-accent': mood.color } as CSSProperties}>
    <header className="music-header"><a className="music-brand" href="#" onClick={event => { if (browser) { event.preventDefault(); void close(); } }}><span><Icon name="spark" size={23} /></span>tuniko<span className="brand-period">.</span></a><div id="music-search-dock" className="music-search-dock" /><nav aria-label="Music navigation"><a href="#songs" onClick={event => { if (browser) { event.preventDefault(); void close(); } }}>Music</a><a href="#discover" onClick={event => { if (browser) { event.preventDefault(); void close(); } }}>Moods</a><a href="#buddy-settings" onClick={event => { if (browser) { event.preventDefault(); void close(); } }}>Your buddy</a><button aria-label="Pause visual motion" aria-pressed={still || reduced} disabled={reduced} onClick={() => setStill(!still)}><Icon name={still || reduced || hidden ? 'play' : 'pause'} size={16} /></button></nav>{modernDesign && <details className="home-settings"><summary aria-label="Settings">&#8943;</summary><div><button onClick={()=>setBuddyHidden(value=>!value)}>{buddyHidden?'Show companion':'Hide companion'}</button><button onClick={()=>{const menu=document.querySelector<HTMLDetailsElement>('.companion-menu');if(menu){menu.open=true;menu.scrollIntoView({block:'start'});}}}>Customize companion</button><button aria-pressed={still} onClick={()=>setStill(value=>!value)}>{still?'Resume motion':'Pause motion'}</button></div></details>}</header>
    {error && <p className="music-error" role="alert">{error}</p>}
    {browser ? <main className="music-browsing"><div className="music-browser-toolbar"><button onClick={() => void close()}>Back to listening</button><button aria-label="Back" disabled={!browser.back} onClick={() => void call({ type: 'browser', action: 'back' })}>‹</button><button aria-label="Forward" disabled={!browser.forward} onClick={() => void call({ type: 'browser', action: 'forward' })}>›</button><button aria-label="Reload" onClick={() => void call({ type: 'browser', action: 'reload' })}>↻</button><form onSubmit={event => { event.preventDefault(); void open(address); }}><input aria-label="Website address" value={address} onChange={event => setAddress(event.target.value)} /></form></div>{browser.error && <p role="alert" className="music-error">{browser.error}</p>}<div className="music-browser-host" ref={host} /></main> : <main>
      <details className="analog-room" open={modernDesign ? undefined : true}><summary>Listening room</summary><section className="music-hero" aria-label="Listening room">
        <div className="music-copy"><span className="music-eyebrow"><i />YOUR LITTLE LISTENING ROOM</span><h1>A little room<br />for <em>good sounds.</em></h1><p>Pick a mood. Let the world soften.</p><div className="music-moods" role="group" aria-label="Listening mood">{moods.map(value => <button key={value.id} aria-pressed={value.id === preferences.mood} onClick={() => void choose(value.id)}><span className={`mood-symbol ${value.id}`} />{value.name}</button>)}</div><span className="mood-caption">{mood.caption}</span><a className="music-find-button" href="#catalog">Find your sound <Icon name="arrow" size={17} /></a><RoomControls preferences={preferences} update={update} /></div>
        <div className="music-stage" onPointerMove={event => { if (reduced || still) return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--record-tilt', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 8}deg`); event.currentTarget.style.setProperty('--buddy-look-x', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 6}px`); event.currentTarget.style.setProperty('--buddy-look-y', `${(event.clientY - rect.top - rect.height / 2) / rect.height * 4}px`); }} onPointerLeave={event => event.currentTarget.style.setProperty('--record-tilt', '0deg')}>
          <ListeningRoom preferences={preferences} update={update} />
          <span className="sound-orbit one" /><span className="sound-orbit two" /><span className="sound-spark first">✦</span><span className="sound-spark second">✧</span><span className="sound-spark third">♪</span>
          <div className="record-shadow" /><div className="turntable"><div className="turntable-edge" /><button className="record" aria-label={playing ? 'Pause ambient loop' : 'Play ambient loop'} onClick={() => void play()}><span className="vinyl"><span className="record-label"><span>TUNIKO</span><Icon name="spark" size={27} /><span>SIDE A · {mood.name.toUpperCase()}</span></span><span className="record-hole" /></span></button><div className="tonearm"><span /><i /></div><span className="turntable-light" /><span className="turntable-wordmark">a little analog magic.</span></div>
        </div>
        <div className="music-hero-bottom"><a href="#discover">Find your next favorite <span>↓</span></a></div>
      <label className="ambient-volume">Ambience<input aria-label="Volume" type="range" min="0" max="1" step=".01" value={preferences.volume} onChange={event => { const volume = Number(event.target.value); update({ volume }); audio.current.volume(volume); }} /></label></section></details>
      <SongDiscovery modernDesign={modernDesign} query={query} setQuery={setQuery} stopAmbient={stop} ambientPlaying={playing} onPlaybackChange={setSongPlaying} />
      <details className="companion-menu" open={modernDesign ? undefined : true}><summary>Your companion</summary><section className="buddy-settings" id="buddy-settings"><div><span className="music-eyebrow">GOOD COMPANY</span><h2>Make a little friend.</h2><p>A name. A look. A little personality.</p><span className="buddy-memory">{preferences.affection >= 5 ? `${preferences.name} is getting comfortable with you.` : 'Say hello to build a little familiarity.'}</span></div><div className="buddy-customizer"><div className="buddy-settings-actions"><button onClick={() => { update({ x: .86, y: .72 }); setBuddyHidden(false); }}>Reset position</button><button onClick={() => setBuddyHidden(!buddyHidden)}>{buddyHidden ? 'Show buddy' : 'Hide buddy'}</button></div><label>Name<input aria-label="Companion name" maxLength={24} defaultValue={preferences.name} onBlur={event => update({ name: event.target.value.trim() })} /></label><label>Temperament<select aria-label="Companion temperament" value={preferences.personality} onChange={event => update({ personality: event.target.value as MusicPreferences['personality'] })}><option value="gentle">Gentle</option><option value="curious">Curious</option><option value="playful">Playful</option></select></label><fieldset><legend>Color</legend>{(['lilac', 'peach', 'mint', 'sky', 'rose', 'gold'] as const).map(color => <button className={`buddy-swatch ${color}`} key={color} aria-label={`${color} companion`} aria-pressed={preferences.color === color} onClick={() => update({ color })} />)}</fieldset><label>Custom color<input type="color" aria-label="Companion custom color" value={preferences.customColor} onChange={event => update({ customColor: event.target.value, color: 'custom' })} /></label><label>Shape<select aria-label="Companion shape" value={preferences.shape} onChange={event => update({ shape: event.target.value as MusicPreferences['shape'] })}><option value="blob">Little blob</option><option value="cat">Cat</option><option value="bear">Bear</option><option value="star">Star</option></select></label><label>Mood<select aria-label="Companion mood" value={preferences.buddyMood} onChange={event => update({ buddyMood: event.target.value as MusicPreferences['buddyMood'] })}><option value="auto">Follow the music</option><option value="happy">Happy</option><option value="sleepy">Sleepy</option><option value="chill">Chill</option><option value="excited">Excited</option></select></label><label>Little extra<select aria-label="Companion accessory" value={preferences.accessory} onChange={event => update({ accessory: event.target.value as MusicPreferences['accessory'] })}><option value="headphones">Headphones</option><option value="sprout">A tiny sprout</option><option value="cap">Cap</option><option value="bow">Bow</option><option value="glasses">Glasses</option><option value="none">None</option></select></label></div></section></details>
      <footer className="music-footer"><span><Icon name="spark" size={16} />{isPublicDemo ? 'Demo by Kristian Gaydov' : 'Stay for one more song.'}</span><details className="music-extras"><summary>More</summary>{isPublicDemo ? <><a href="./about.html" target="_blank" rel="noopener noreferrer">About Tuniko</a><a href="./privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a></> : <a href="?legacy=1">Previous spaces</a>}</details></footer>
    </main>}
    {!browser && <PhoneNavigation />}
    {!browser && !buddyHidden && <Companion preferences={preferences} playing={(playing || songPlaying) && !still && !reduced} update={update} react={hello} greeting={greeting} />}
    {!browser && buddyHidden && <button className="buddy-restore" onClick={() => setBuddyHidden(false)}>Show {preferences.name}</button>}
    <span id="companion-instructions" className="sr-only">Drag anywhere in this window. Space to pick up, arrows to move, Space to drop, Escape to cancel. Enter to say hello.</span>
  </div>;
}
