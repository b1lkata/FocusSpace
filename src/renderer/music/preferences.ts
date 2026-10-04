import { z } from 'zod';
export const musicPreferenceKey = 'focusspace.music.v1';
export const musicPreferences = z.object({
  room: z.enum(['cozy', 'night', 'neon']).default('cozy'), roomLights: z.boolean().default(true), roomDetails: z.boolean().default(true),
  mood: z.enum(['drift', 'glow', 'afterhours']), volume: z.number().min(0).max(1),
  name: z.string().trim().min(1).max(24), color: z.enum(['lilac', 'peach', 'mint', 'sky', 'rose', 'gold', 'custom']),
  shape: z.enum(['blob', 'cat', 'bear', 'star']).default('blob'), customColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).default('#baa1e6'), buddyMood: z.enum(['auto', 'happy', 'sleepy', 'chill', 'excited']).default('auto'),
  accessory: z.enum(['headphones', 'sprout', 'cap', 'bow', 'glasses', 'none']), personality: z.enum(['gentle', 'curious', 'playful']),
  affection: z.number().int().min(0).max(10000), x: z.number().min(0).max(1), y: z.number().min(0).max(1),
}).strict();
export type MusicPreferences = z.infer<typeof musicPreferences>;
export const initialMusicPreferences: MusicPreferences = musicPreferences.parse({ mood: 'drift', volume: .35, name: 'Pip', color: 'lilac', accessory: 'headphones', personality: 'curious', affection: 0, x: .86, y: .72 });
export function readMusicPreferences(storage: Pick<Storage, 'getItem'>): MusicPreferences {
  const raw = storage.getItem(musicPreferenceKey);
  return raw === null ? { ...initialMusicPreferences } : musicPreferences.parse(JSON.parse(raw));
}
