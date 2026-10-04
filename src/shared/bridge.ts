import { z } from 'zod';
import { stateSchema, positionSchema, type AppState } from './model';
import { jamendoQuery, jamendoClientId } from './jamendo';
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('jamendo-search'), options: jamendoQuery }).strict(),
  z.object({ type: z.literal('jamendo-status') }).strict(),
  z.object({ type: z.literal('jamendo-client'), clientId: z.union([jamendoClientId, z.literal('')]) }).strict(),
  z.object({ type: z.literal('save-song-card'), format: z.enum(['story', 'square']), data: z.string().min(1).max(6_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
  z.object({ type: z.literal('music-search'), query: z.string().max(200), discover: z.boolean() }).strict(),
  z.object({ type: z.literal('load') }).strict(),
  z.object({ type: z.literal('browse'), url: z.string().min(1).max(2048) }).strict(),
  z.object({ type: z.literal('save'), state: stateSchema }).strict(),
  z.object({ type: z.literal('open'), workspaceId: z.string().max(100), cardId: z.string().max(100) }).strict(),
  z.object({ type: z.literal('browser'), action: z.enum(['back', 'forward', 'reload', 'close', 'navigate']), url: z.string().max(2048).optional() }).strict(),
  z.object({ type: z.literal('bounds'), rect: z.object({ x: z.number().int().min(0), y: z.number().int().min(0), width: z.number().int().min(0), height: z.number().int().min(0) }).strict() }).strict(),
  z.object({ type: z.literal('extract') }).strict(),
  z.object({ type: z.literal('ai'), requestId: z.string().max(100), kind: z.enum(['briefing', 'summary', 'compare', 'organize', 'tasks']), workspaceId: z.string().max(100), content: z.string().max(40000) }).strict(),
  z.object({ type: z.literal('cancel'), requestId: z.string().max(100) }).strict(),
  z.object({ type: z.literal('key'), key: z.string().max(500) }).strict(),
  z.object({ type: z.literal('key-status') }).strict(),
  z.object({ type: z.literal('export') }).strict(),
  z.object({ type: z.literal('import-preview') }).strict(),
  z.object({ type: z.literal('import-accept'), token: z.string().max(100) }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const aiResultSchema = z.object({ text: z.string().min(1).max(20000), tasks: z.array(z.string().min(1).max(200)).max(20), positions: z.array(z.object({ cardId: z.string().max(100), position: positionSchema }).strict()).max(200) }).strict();
export type AIResult = z.infer<typeof aiResultSchema> & { provider: 'demo' | 'openai' };
export type BrowserState = { cardId: string; url: string; title: string; loading: boolean; back: boolean; forward: boolean; error?: string };
export type Event = { type: 'browser'; state: BrowserState } | { type: 'state'; state: AppState } | { type: 'notice'; message: string } | { type: 'persistence'; status: 'saving' | 'saved' | 'error' };
export type Reply = { ok: true; data: unknown } | { ok: false; error: string };
export interface Bridge { call(command: Command): Promise<Reply>; subscribe(listener: (event: Event) => void): () => void }
declare global { interface Window { focusspace: Bridge } }
