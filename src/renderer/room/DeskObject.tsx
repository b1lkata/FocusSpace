import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Line } from '@react-three/drei';
import type { Group } from 'three';
import type { Card } from '../../shared/model';

function Block({ size, position, color, radius = .08 }: { size: [number, number, number]; position: [number, number, number]; color: string; radius?: number }) {
  return <RoundedBox args={size} position={position} radius={radius} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.55} /></RoundedBox>;
}

/** Small, recognizable desk objects. Animation is presentation only, never stored. */
export function DeskObject({ card, active, motion }: { card: Card; active: boolean; motion: boolean }) {
  const figure = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!figure.current) return;
    const phase = clock.elapsedTime + card.position[0] * .4;
    figure.current.position.y = motion ? Math.sin(phase * 1.2) * .045 : 0;
    figure.current.rotation.y = motion ? Math.sin(phase * .7) * (active ? .09 : .025) : 0;
  });
  return <group ref={figure}>
    {card.kind === 'website' ? <group rotation={[-.18, 0, 0]}>
      <Block size={[2.9, 1.85, .25]} position={[0, 1.35, 0]} color={active ? '#c9b9fa' : '#9e94ca'} radius={.15} />
      <Block size={[2.62, 1.54, .06]} position={[0, 1.36, .15]} color="#202b40" />
      <Block size={[2.48, .22, .07]} position={[0, 1.98, .2]} color="#56647f" radius={.025} />
      {[-1.05, -.88, -.71].map((x, i) => <mesh key={x} position={[x, 1.98, .25]}><sphereGeometry args={[.04, 12, 8]} /><meshStandardMaterial color={['#ffb6b6', '#ffdc9a', '#a2e6cf'][i]} /></mesh>)}
      <Block size={[.68, .65, .08]} position={[-.7, 1.35, .22]} color="#b0a3e0" />
      <Block size={[1.06, .12, .08]} position={[.35, 1.54, .22]} color="#cbd5e9" radius={.03} />
      <Block size={[.8, .1, .08]} position={[.22, 1.28, .22]} color="#778baa" radius={.03} />
      <Block size={[1.8, .09, .08]} position={[0, .88, .22]} color="#576880" radius={.025} />
      <Block size={[.32, .64, .28]} position={[0, .36, -.06]} color="#8c83b6" />
      <Block size={[1.3, .12, .7]} position={[0, .09, .1]} color="#b7add7" />
    </group> : card.kind === 'note' ? <group rotation={[-.32, 0, -.07]}>
      <Block size={[2.1, 2.15, .2]} position={[0, 1.15, 0]} color={active ? '#ffe3a3' : '#dfbd80'} radius={.12} />
      <Block size={[1.93, 1.98, .06]} position={[0, 1.17, .14]} color="#fff0cd" radius={.04} />
      {[1.65, 1.35, 1.05, .75].map((y, i) => <Block key={y} size={[i === 3 ? .8 : 1.35, .035, .03]} position={[i === 3 ? -.27 : 0, y, .19]} color="#bd9e73" radius={.01} />)}
      {[-.7, -.35, 0, .35, .7].map(x => <mesh key={x} position={[x, 2.14, .05]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[.11, .025, 8, 16]} /><meshStandardMaterial color="#7d849c" metalness={.5} roughness={.35} /></mesh>)}
      <group position={[1.15, .92, .28]} rotation={[0, 0, -.25]}>
        <mesh castShadow><cylinderGeometry args={[.09, .09, 1.8, 6]} /><meshStandardMaterial color="#e9ab7f" /></mesh>
        <mesh position={[0, -.99, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[.09, .2, 6]} /><meshStandardMaterial color="#55516a" /></mesh>
        <Block size={[.2, .2, .2]} position={[0, .94, 0]} color="#f2c4c5" radius={.03} />
      </group>
    </group> : <group position={[0, 1.05, 0]} rotation={[-.22, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[1.02, 1.02, .3, 64]} /><meshStandardMaterial color={card.done ? '#8ed8b6' : '#98c8c1'} roughness={.45} /></mesh>
      <mesh position={[0, 0, .17]}><torusGeometry args={[.8, .045, 12, 64]} /><meshStandardMaterial color="#ddfff0" /></mesh>
      <Line points={[[-.42, 0, .2], [-.1, -.3, .2], [.46, .36, .2]]} color="#f1fff8" lineWidth={7} />
      <Block size={[1.05, .13, .7]} position={[0, -.96, 0]} color="#5b8c85" />
    </group>}
  </group>;
}

