import { describe, expect, it } from 'vitest';
import { initialMusicPreferences, musicPreferences, readMusicPreferences } from '../src/renderer/music/preferences';
describe('separate music preferences', () => {
  it('uses a fresh default only for missing data', () => {
    expect(readMusicPreferences({ getItem: () => null })).toEqual(initialMusicPreferences);
    expect(() => readMusicPreferences({ getItem: () => '{broken' })).toThrow();
    expect(() => readMusicPreferences({ getItem: () => '{}' })).toThrow();
  });
  it('restores a customized companion and bounded position', () => {
    const saved = { ...initialMusicPreferences, name: 'Mochi', personality: 'playful', color: 'mint', affection: 9, x: .2, y: .8 };
    expect(readMusicPreferences({ getItem: () => JSON.stringify(saved) })).toEqual(saved);
  });
  it('rejects unsafe volume, position, names and unsupported attributes', () => {
    for (const value of [{ volume: 1.2 }, { x: -1 }, { y: 2 }, { name: ' ' }, { name: 'a'.repeat(25) }, { affection: -1 }, { secret: 'unwanted' }]) expect(musicPreferences.safeParse({ ...initialMusicPreferences, ...value }).success).toBe(false);
  });
  it('upgrades old companion settings without losing existing customization', () => {
    const legacy: Record<string, unknown> = { ...initialMusicPreferences }; delete legacy.shape; delete legacy.customColor; delete legacy.buddyMood;
    const restored = readMusicPreferences({ getItem: () => JSON.stringify({ ...legacy, name: 'Mochi', x: .2, color: 'mint' }) });
    expect(restored).toMatchObject({ name: 'Mochi', x: .2, color: 'mint', shape: 'blob', buddyMood: 'auto', customColor: '#baa1e6' });
    expect(musicPreferences.safeParse({ ...restored, customColor: 'url(https://invalid)' }).success).toBe(false);
  });

  it('adds room defaults to existing settings and rejects unsupported rooms', () => {
    const legacy: Record<string, unknown> = { ...initialMusicPreferences, name: 'Mochi', volume: .2 };
    delete legacy.room; delete legacy.roomLights; delete legacy.roomDetails;
    expect(readMusicPreferences({ getItem: () => JSON.stringify(legacy) })).toMatchObject({ name: 'Mochi', volume: .2, room: 'cozy', roomLights: true, roomDetails: true });
    expect(() => readMusicPreferences({ getItem: () => JSON.stringify({ ...legacy, room: 'unknown' }) })).toThrow();
  });
});
