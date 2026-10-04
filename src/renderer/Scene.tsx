import { Component, useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, Grid } from '@react-three/drei';
import { Icon } from './design/Icon';
import './room/room.css';
import { DeskObject } from './room/DeskObject';
import { Vector3, Vector2, Raycaster, Plane } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import type { Card, Position, Workspace } from '../shared/model';
class Boundary extends Component<{ children: ReactNode; fallback: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.fallback(); }
  render() { return this.state.failed ? <p>3D is unavailable. Switching to the accessible grid.</p> : this.props.children; }
}
function SpatialCard({ card, arrange, selected, open, move, dragState, portal, motion }: { card: Card; arrange: boolean; selected: boolean; open: () => void; move: (p: Position) => void; dragState: (value: boolean) => void; portal: RefObject<HTMLDivElement>; motion: boolean }) {
  const view = useThree();
  const [hover, setHover] = useState(false);
  const [position, setPosition] = useState<Position | undefined>();
  const dragging = useRef(false);
  const offset = useRef(new Vector3());
  const plane = new Plane(new Vector3(0, 1, 0), 0);
  const point = new Vector3();
  function labelEvent(event: ReactPointerEvent<HTMLDivElement>, handler: (event: ThreeEvent<PointerEvent>) => void) {
    if (!arrange) return;
    const bounds = view.gl.domElement.getBoundingClientRect();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1), view.camera);
    handler({ ray: ray.ray, pointerId: event.pointerId, target: event.currentTarget, stopPropagation: () => event.stopPropagation() } as unknown as ThreeEvent<PointerEvent>);
  }
  function start(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!arrange) return;
    if (!event.ray.intersectPlane(plane, point)) return;
    offset.current.copy(point).sub(new Vector3(...card.position));
    dragging.current = true; dragState(true);
    (event.target as unknown as { setPointerCapture(id: number): void }).setPointerCapture(event.pointerId);
  }
  function drag(event: ThreeEvent<PointerEvent>) {
    if (!dragging.current) return;
    event.stopPropagation();
    if (event.ray.intersectPlane(plane, point)) {
      point.sub(offset.current); setPosition([Math.max(-30, Math.min(30, point.x)), 0, Math.max(-30, Math.min(30, point.z))]);
    }
  }
  function stop(event: ThreeEvent<PointerEvent>) {
    if (!dragging.current) return;
    event.stopPropagation(); dragging.current = false; dragState(false);
    (event.target as unknown as { releasePointerCapture(id: number): void }).releasePointerCapture(event.pointerId);
    if (position) move(position); setPosition(undefined);
  }
  return <group position={position ?? card.position}>
    <group onPointerDown={start} onPointerMove={drag} onPointerUp={stop} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} onClick={event => { event.stopPropagation(); if (!arrange) open(); }}>
      <DeskObject card={card} active={selected || hover} motion={motion && !arrange} />
      <mesh position={[0, 1, 0]}><boxGeometry args={[3.2, 2.4, .6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>
    <Html portal={portal} position={[0, .45, .8]} transform sprite distanceFactor={7} pointerEvents="auto" style={{ pointerEvents: 'auto' }}>
      <div style={{ touchAction: 'none' }} onPointerDown={event => labelEvent(event, start)} onPointerMove={event => labelEvent(event, drag)} onPointerUp={event => labelEvent(event, stop)}>
      <button data-card-id={card.id} className={`scene-label ${selected ? 'chosen' : ''}`} onClick={open} disabled={arrange}>
        <strong>{card.title}</strong>
      </button>
      </div>
    </Html>
  </group>;
}
function GraphicsHealth({ fallback }: { fallback: () => void }) {
  const renderer = useThree(state => state.gl);
  useEffect(() => {
    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', fallback);
    return () => canvas.removeEventListener('webglcontextlost', fallback);
  }, [renderer, fallback]);
  return null;
}
function Room({ workspace, arrange, selected, open, move, camera, portal, fallback, motion }: { workspace: Workspace; arrange: boolean; selected?: string; open: (c: Card) => void; move: (id: string, p: Position) => void; camera: (value: Workspace['camera']) => void; portal: RefObject<HTMLDivElement>; fallback: () => void; motion: boolean }) {
  const controls = useRef<Controls>(null);
  const [dragging, setDragging] = useState(false);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (!motion || arrange) return;
    const timer = window.setInterval(() => { if (!document.hidden) invalidate(); }, 40);
    return () => window.clearInterval(timer);
  }, [motion, arrange, invalidate]);
  return <>
    <GraphicsHealth fallback={fallback} />
    <color attach="background" args={['#171c29']} />
    <fog attach="fog" args={['#171c29', 25, 75]} />
    <ambientLight intensity={1.5} /><hemisphereLight args={['#c7d5ff', '#494160', 1.3]} />
    <directionalLight position={[-8, 14, 6]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-normalBias={.04} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.025, 0]} receiveShadow><planeGeometry args={[240, 240]} /><meshStandardMaterial color="#22293a" roughness={1} /></mesh>
    {arrange && <Grid position={[0, -.01, 0]} args={[80, 80]} cellSize={3.8} cellThickness={.6} cellColor="#70758c" sectionSize={15.2} sectionColor="#858097" fadeDistance={30} infiniteGrid />}
    {workspace.cards.map(card => <SpatialCard key={card.id} portal={portal} motion={motion} card={card} arrange={arrange} selected={selected === card.id} open={() => open(card)} move={p => move(card.id, p)} dragState={setDragging} />)}
    <OrbitControls ref={controls} enabled={!dragging} target={workspace.camera.target} minDistance={4} maxDistance={100} maxPolarAngle={Math.PI / 2.1} enableDamping={false} onEnd={() => {
      if (controls.current) camera({ position: controls.current.object.position.toArray() as Position, target: controls.current.target.toArray() as Position });
    }} />
  </>;
}
export function Scene(props: { workspace: Workspace; arrange: boolean; selected?: string; open: (c: Card) => void; move: (id: string, p: Position) => void; camera: (value: Workspace['camera']) => void; fallback: () => void; cameraRevision: number }) {
  const portal = useRef<HTMLDivElement>(null!);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [available] = useState(() => {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) return false;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch { return false; }
  });
  useEffect(() => { if (!available) props.fallback(); }, [available, props.fallback]);
  if (!available) return <p role="status">3D is unavailable. Switching to grid view…</p>;
  return <Boundary fallback={props.fallback}><div className="scene-root spatial-desk"><div className="room-heading"><Icon name="spark" size={16} /><span>A little world of ideas.</span><button className="room-motion" aria-label={paused ? 'Play object motion' : 'Pause object motion'} onClick={() => setPaused(value => !value)} disabled={reduced}><Icon name={paused || reduced ? 'play' : 'pause'} size={14} /></button></div><div ref={portal} className="scene-overlays" /><Canvas shadows key={`${props.workspace.id}-${props.cameraRevision}`} frameloop="demand" camera={{ position: props.workspace.camera.position, fov: 48 }} dpr={[1, 1.5]} fallback={<p>3D requires canvas support.</p>}><Room {...props} portal={portal} motion={!paused && !reduced} /></Canvas></div></Boundary>;
}
