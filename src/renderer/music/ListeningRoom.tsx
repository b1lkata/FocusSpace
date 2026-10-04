import { useEffect, useRef, useState } from 'react';
import type { MusicPreferences } from './preferences';
export function ListeningRoom({ preferences: p, update }: { preferences: MusicPreferences; update: (value: Partial<MusicPreferences>) => void }) {
  const [grown, setGrown] = useState(false); const [wish, setWish] = useState(false); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <div className={`listening-room room-${p.room} ${p.roomLights ? 'room-lit' : 'room-dim'} ${p.roomDetails ? '' : 'room-simple'} ${wish ? 'room-wish' : ''}`} aria-label={`${p.room} listening room`}>
    <span className="room-wall" /><span className="room-floor" />
    <div className="room-window" aria-hidden="true"><span className="room-moon" /><i /><i /><i /><span className="room-horizon" /></div>
    <button className="room-lamp" aria-label="Room lamp" aria-pressed={p.roomLights} onClick={() => update({ roomLights: !p.roomLights })}><span className="lamp-glow" /><span className="lamp-shade" /><span className="lamp-stem" /><span className="lamp-base" /></button>
    <button className={`room-plant ${grown ? 'plant-grown' : ''}`} aria-label="Grow room plant" aria-pressed={grown} onClick={() => setGrown(value => !value)}><span className="plant-stem" /><i /><i /><i /><i /><span className="plant-pot" /></button>
    <button className="room-constellation" aria-label="Make a wish" onClick={() => { setWish(false); requestAnimationFrame(() => setWish(true)); clearTimeout(timer.current); timer.current = setTimeout(() => setWish(false), 1400); }}><svg viewBox="0 0 100 70" aria-hidden="true"><path d="M12 46 36 14 61 44 88 22" /><circle cx="12" cy="46" r="3" /><circle cx="36" cy="14" r="4" /><circle cx="61" cy="44" r="3" /><circle cx="88" cy="22" r="3" /></svg></button>
    <span className="room-neon-sign" aria-hidden="true">stay a little.</span><span className="room-wish-trail" aria-hidden="true" />
    <span className="room-hint">{p.room === 'cozy' ? 'Tap the lamp. Tend your little plant.' : p.room === 'night' ? 'A quiet sky. Make a little wish.' : 'A little glow for the late hours.'}</span>
  </div>;
}
export function RoomControls({ preferences: p, update }: { preferences: MusicPreferences; update: (value: Partial<MusicPreferences>) => void }) {
  return <div className="room-controls"><span className="music-eyebrow">YOUR ROOM</span><div role="group" aria-label="Listening room style">{(['cozy', 'night', 'neon'] as const).map(room => <button key={room} aria-label={`${room} room`} aria-pressed={p.room === room} onClick={() => update({ room })}><span className={`room-dot ${room}`} />{room === 'cozy' ? 'Cozy' : room === 'night' ? 'Night sky' : 'Neon'}</button>)}</div><button className="room-details-toggle" aria-pressed={p.roomDetails} onClick={() => update({ roomDetails: !p.roomDetails })}>{p.roomDetails ? 'Less detail' : 'Show details'}</button></div>;
}
