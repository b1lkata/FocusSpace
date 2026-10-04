import { useEffect, useRef, useState, type RefObject } from 'react';
import { FocusField as Field } from './FocusFieldEngine';
import { Icon } from './Icon';
import './living.css';
import './typography.css';

export function FocusField({ surface, home, quiet }: { surface: RefObject<HTMLDivElement | null>; home: boolean; quiet: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Field | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    if (canvas.current && surface.current) engine.current = new Field(canvas.current, surface.current);
    return () => { media.removeEventListener('change', update); engine.current?.dispose(); engine.current = null; };
  }, [surface]);
  useEffect(() => { engine.current?.setMode(home, paused, reduced, quiet); }, [home, paused, reduced, quiet]);
  return <>
    <div className={`focus-field ${quiet ? 'quiet' : ''}`} aria-hidden="true"><canvas className="focus-field-canvas" ref={canvas} /></div>
    {!quiet && <div className="field-controls" role="group" aria-label="Background controls" data-modal-background>
      <button aria-label="Rotate background" title="Rotate background" onClick={() => engine.current?.rotate()}><Icon name="orbit" size={16} /></button>
      <button aria-label="Reset background" title="Reset background" onClick={() => engine.current?.reset()}><Icon name="reset" size={16} /></button>
      <button className="motion-switch" aria-label="Pause background animation" title={reduced ? 'Reduced motion is on' : paused ? 'Resume background animation' : 'Pause background animation'} aria-pressed={paused || reduced} disabled={reduced} onClick={() => setPaused(!paused)}><Icon name={paused || reduced ? 'play' : 'pause'} size={14} /><span>{paused || reduced ? 'Still' : 'Live'}</span><i /></button>
    </div>}
  </>;
}
