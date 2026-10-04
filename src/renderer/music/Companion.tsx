import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MusicPreferences } from './preferences';
export function Companion({ preferences: p, playing, update, react, greeting }: { preferences: MusicPreferences; playing: boolean; update: (value: Partial<MusicPreferences>) => void; react: () => void; greeting: string }) {
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const [grabbed, setGrabbed] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [temporary, setTemporary] = useState<{ x: number; y: number }>();
  const active = useRef(false); const pending = useRef<{ x: number; y: number } | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef({ x: p.x, y: p.y, clientX: 0, clientY: 0 });
  const location = temporary ?? p;
  const width = Math.max(1, viewport.width - 120); const height = Math.max(1, viewport.height - (viewport.width <= 760 ? 300 : 150));
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  useEffect(() => { const resize = () => setViewport({ width: innerWidth, height: innerHeight }); addEventListener('resize', resize); return () => { removeEventListener('resize', resize); if (timer.current) clearTimeout(timer.current); }; }, []);
  function move(value: { x: number; y: number }) { pending.current = value; setTemporary(value); }
  function drop(cancel = false) { if (pending.current && !cancel) update(pending.current); pending.current = undefined; active.current = false; setTemporary(undefined); setGrabbed(false); }
  function hello() { react(); setSpeaking(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setSpeaking(false), 4000); }
  function point(clientX: number, clientY: number) { return { x: clamp(origin.current.x + (clientX - origin.current.clientX) / width), y: clamp(origin.current.y + (clientY - origin.current.clientY) / height) }; }
  return <div className={`music-companion viewport-companion ${p.color} ${p.personality} shape-${p.shape} mood-${p.buddyMood} ${playing && !['sleepy', 'chill'].includes(p.buddyMood) ? 'dancing' : ''} ${grabbed ? 'grabbed' : ''}`} style={{ left: location.x * width, top: location.y * height, ...(p.color === 'custom' ? { '--buddy-color': p.customColor } : {}) } as CSSProperties}>
    {speaking && <p className="companion-bubble" role="status" style={{ width: Math.min(220, viewport.width - 16), left: Math.max(8 - location.x * width, Math.min(-45, viewport.width - 228 - location.x * width)), top: location.y * height > 65 ? -60 : 154 }}>{greeting}</p>}
    <button className="companion-body" aria-label={`Move ${p.name}`} aria-describedby="companion-instructions" title="Drag anywhere. Enter to say hello." onPointerDown={event => {
      if (event.button !== 0) return;
      origin.current = { x: p.x, y: p.y, clientX: event.clientX, clientY: event.clientY }; active.current = true; setGrabbed(true); move({ x: p.x, y: p.y }); event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => { if (active.current) move(point(event.clientX, event.clientY)); }} onPointerUp={event => {
      if (!active.current) return; const moved = Math.hypot(event.clientX - origin.current.clientX, event.clientY - origin.current.clientY) > 4;
      move(point(event.clientX, event.clientY)); drop(); if (!moved) hello();
    }} onPointerCancel={() => drop(true)} onLostPointerCapture={() => { if (active.current) drop(true); }} onKeyDown={event => {
      if (event.key === ' ' && !event.repeat) { event.preventDefault(); if (active.current) drop(); else { active.current = true; origin.current = { x: p.x, y: p.y, clientX: 0, clientY: 0 }; move({ x: p.x, y: p.y }); setGrabbed(true); } }
      if (event.key === 'Escape' && active.current) { event.preventDefault(); drop(true); }
      if (event.key === 'Enter') { event.preventDefault(); hello(); }
      const steps: Record<string, [number, number]> = { ArrowLeft: [-.03, 0], ArrowRight: [.03, 0], ArrowUp: [0, -.03], ArrowDown: [0, .03] };
      if (active.current && steps[event.key]) { event.preventDefault(); const [x, y] = steps[event.key]; const value = pending.current ?? location; move({ x: clamp(value.x + x), y: clamp(value.y + y) }); }
    }}><span className="buddy-shadow" /><span className="buddy-rig"><span className="buddy-shape"><span className="buddy-ear left" /><span className="buddy-ear right" /><span className="buddy-eyes"><i /><i /></span><span className="buddy-cheeks"><i /><i /></span><span className="buddy-mouth" /></span><span className={`buddy-accessory ${p.accessory}`}><i /><i /></span><span className="buddy-foot left" /><span className="buddy-foot right" /></span></button>
    <span className="buddy-name">{p.name}<span>{grabbed ? 'Moving' : p.buddyMood !== 'auto' ? ({ happy: 'Happy to be here', sleepy: 'Dreaming of melodies', chill: 'Taking it easy', excited: 'Let’s dance' }[p.buddyMood]) : playing ? 'Feeling this one' : p.affection >= 5 ? 'Your listening buddy' : 'Say hello'}</span></span>
  </div>;
}
