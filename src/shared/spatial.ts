import type { Card, Position, Workspace } from './model';

// Keep the first nine familiar slots, then grow outward in square rings.
export function slotPosition(index: number): Position {
  if (!Number.isInteger(index) || index < 0 || index >= 225) throw new Error('Invalid spatial slot.');
  if (index < 9) return [(index % 3 - 1) * 3.8, 0, Math.floor(index / 3) * 4.2 - 2];
  let offset = index - 9;
  for (let ring = 2; ring <= 7; ring++) {
    const cells: [number, number][] = [];
    for (let x = -ring; x <= ring; x++) cells.push([x, -ring]);
    for (let z = -ring + 1; z <= ring; z++) cells.push([ring, z]);
    for (let x = ring - 1; x >= -ring; x--) cells.push([x, ring]);
    for (let z = ring - 1; z > -ring; z--) cells.push([-ring, z]);
    if (offset < cells.length) { const [x, z] = cells[offset]; return [x * 3.8, 0, z * 4.2 + 2.2]; }
    offset -= cells.length;
  }
  throw new Error('Spatial slot limit reached.');
}
export function nextCardPosition(cards: Pick<Card, 'position'>[]): Position {
  for (let i = 0; i < 225; i++) {
    const position = slotPosition(i);
    if (!cards.some(c => Math.abs(c.position[0] - position[0]) < 3.3 && Math.abs(c.position[2] - position[2]) < 2.2)) return position;
  }
  throw new Error('No free card position. Rearrange cards or use another workspace.');
}
export function fitCamera(cards: Pick<Card, 'position'>[], aspect = 1, fov = 48): Workspace['camera'] {
  if (!cards.length) return { position: [0, 7, 9], target: [0, 0, 0] };
  const xs = cards.map(c => c.position[0]), zs = cards.map(c => c.position[2]);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2;
  const width = Math.max(...xs) - Math.min(...xs) + 4.5, depth = Math.max(...zs) - Math.min(...zs) + 5;
  const tangent = Math.tan(fov * Math.PI / 360);
  const distance = Math.max(10, width / (2 * tangent * Math.max(.2, aspect)), depth / (2 * tangent)) * 1.15;
  // Above the target so the entire floor footprint fits even for narrow windows.
  return { position: [x, Math.min(100, distance), z], target: [x, 0, z] };
}
