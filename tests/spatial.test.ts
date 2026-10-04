import { describe, expect, it } from 'vitest';
import { fitCamera, nextCardPosition, slotPosition } from '../src/shared/spatial';
import { createCard, positionSchema } from '../src/shared/model';
describe('spatial layouts', () => {
  it('places all 200 supported cards in unique bounded slots', () => {
    const positions = Array.from({ length: 200 }, (_, i) => slotPosition(i));
    expect(new Set(positions.map(p => p.join(','))).size).toBe(200);
    positions.forEach(p => expect(positionSchema.safeParse(p).success).toBe(true));
    expect(Math.max(...positions.map(p => Math.abs(p[0])))).toBeLessThan(30);
    expect(Math.max(...positions.map(p => Math.abs(p[2])))).toBeLessThan(35);
  });
  it('fills a deleted slot without overlapping remaining or manually moved cards', () => {
    const cards = Array.from({ length: 8 }, (_, i) => createCard('note', `Note ${i}`, i));
    cards.splice(2, 1); expect(nextCardPosition(cards)).toEqual(slotPosition(2));
    cards[0].position = slotPosition(2); expect(nextCardPosition(cards)).toEqual(slotPosition(0));
  });
  it('fits a large room at narrow aspect ratios and preserves the center', () => {
    const cards = Array.from({ length: 200 }, (_, i) => ({ position: slotPosition(i) }));
    const wide = fitCamera(cards, 2), narrow = fitCamera(cards, .8);
    expect(narrow.target).toEqual(wide.target); expect(narrow.position[1]).toBeGreaterThan(wide.position[1]);
    expect(narrow.position[0]).toBe(narrow.target[0]); expect(narrow.position[2]).toBe(narrow.target[2]);
    expect(positionSchema.safeParse(narrow.position).success).toBe(true);
  });
});
