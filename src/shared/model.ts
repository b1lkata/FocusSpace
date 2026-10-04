import { z } from 'zod';
import { slotPosition } from './spatial';

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) throw new Error('Enter a website address.');
  const value = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP and HTTPS addresses without credentials are supported.');
  return url.href;
}
const id = z.string().min(1).max(100);
const text = z.string().max(20000);
export const positionSchema = z.tuple([z.number().finite().min(-100).max(100), z.number().finite().min(-100).max(100), z.number().finite().min(-100).max(100)]);
export const cardSchema = z.object({
  id, kind: z.enum(['website', 'note', 'task']), title: z.string().min(1).max(200),
  body: text, url: z.string().max(2048).optional(), done: z.boolean(), linkedCardId: id.optional(),
  position: positionSchema, updatedAt: z.string(),
}).strict().superRefine((card, ctx) => {
  if (card.kind === 'website') { try { normalizeUrl(card.url ?? ''); } catch { ctx.addIssue({ code: 'custom', message: 'Invalid website URL' }); } }
});
export const summarySchema = z.object({ cardId: id, url: z.string().max(2048), capturedAt: z.string(), text, provider: z.enum(['demo', 'openai']) }).strict();
export const briefingSchema = z.object({ createdAt: z.string(), text, sourceIds: z.array(id).max(100), provider: z.enum(['demo', 'openai']) }).strict();
export const workspaceSchema = z.object({
  id, name: z.string().min(1).max(100), description: z.string().max(1000), accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  createdAt: z.string(), updatedAt: z.string(), lastUsedAt: z.string(), archived: z.boolean(),
  leftOff: text, cards: z.array(cardSchema).max(200),
  camera: z.object({ position: positionSchema, target: positionSchema }).strict(),
  activity: z.array(z.object({ id, at: z.string(), type: z.string().max(100), cardId: id.optional(), detail: z.string().max(300) }).strict()).max(300),
  summaries: z.array(summarySchema).max(100), briefing: briefingSchema.optional(),
}).strict().superRefine((w, ctx) => {
  if (new Set(w.cards.map(c => c.id)).size !== w.cards.length) ctx.addIssue({ code: 'custom', message: 'Duplicate card IDs' });
  for (const c of w.cards) if (c.linkedCardId && !w.cards.some(x => x.id === c.linkedCardId && x.kind === 'website')) ctx.addIssue({ code: 'custom', message: 'Invalid task link' });
});
export const preferencesSchema = z.object({ mode: z.enum(['2d', '3d']), provider: z.enum(['demo', 'openai']), model: z.string().min(1).max(100), activeWorkspaceId: id.optional() }).strict();
export const stateSchema = z.object({ version: z.literal(1), workspaces: z.array(workspaceSchema).max(100), preferences: preferencesSchema }).strict().superRefine((s, ctx) => {
  if (new Set(s.workspaces.map(w => w.id)).size !== s.workspaces.length) ctx.addIssue({ code: 'custom', message: 'Duplicate workspace IDs' });
});
export const exportSchema = z.object({ format: z.literal('focusspace'), version: z.literal(1), workspaces: z.array(workspaceSchema).max(100) }).strict();
export type Card = z.infer<typeof cardSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type AppState = z.infer<typeof stateSchema>;
export type Position = z.infer<typeof positionSchema>;
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const defaultCamera = (): Workspace['camera'] => ({ position: [0, 7, 9], target: [0, 0, 0] });
export function createWorkspace(name: string): Workspace {
  const at = now();
  return { id: uid(), name, description: '', accent: '#8b8aff', createdAt: at, updatedAt: at, lastUsedAt: at, archived: false, leftOff: '', cards: [], camera: defaultCamera(), activity: [], summaries: [] };
}
export function createCard(kind: Card['kind'], title: string, count: number, url?: string): Card {
  return { id: uid(), kind, title: title.slice(0, 200), body: '', url: kind === 'website' ? normalizeUrl(url ?? title) : undefined, done: false, updatedAt: now(), position: slotPosition(count) };
}
export function record(w: Workspace, type: string, detail: string, cardId?: string): void {
  w.updatedAt = now();
  w.activity.unshift({ id: uid(), at: now(), type, detail: detail.slice(0, 300), cardId });
  w.activity = w.activity.slice(0, 300);
}
export function emptyState(): AppState { return { version: 1, workspaces: [], preferences: { mode: '3d', provider: 'demo', model: 'gpt-4.1-mini' } }; }
export function demoWorkspace(): Workspace {
  const w = createWorkspace('Build My App'); w.description = 'Demo workspace · fictional notes and tasks';
  w.cards = [createCard('website', 'React documentation', 0, 'https://react.dev'), createCard('website', 'Electron documentation', 1, 'https://www.electronjs.org/docs/latest'), createCard('note', 'A calmer way to work', 2), createCard('task', 'Sketch the first workspace', 3)];
  w.cards[2].body = 'Demo note: keep the room simple. Make the next unfinished step easy to find.';
  w.leftOff = 'Demo: I was exploring the application shell. Next, sketch the workspace navigation.';
  record(w, 'demo-created', 'Optional fictional demo data'); return w;
}
export function remapImport(raw: unknown): Workspace[] {
  const parsed = exportSchema.parse(raw);
  return parsed.workspaces.map(w => {
    const mapping = new Map(w.cards.map(c => [c.id, uid()]));
    return { ...w, id: uid(), name: `${w.name} (imported)`.slice(0, 100), cards: w.cards.map(c => ({ ...c, id: mapping.get(c.id)!, linkedCardId: c.linkedCardId ? mapping.get(c.linkedCardId) : undefined })),
      activity: w.activity.map(a => ({ ...a, id: uid(), cardId: a.cardId ? mapping.get(a.cardId) : undefined })),
      summaries: w.summaries.filter(s => mapping.has(s.cardId)).map(s => ({ ...s, cardId: mapping.get(s.cardId)! })),
      briefing: w.briefing ? { ...w.briefing, sourceIds: w.briefing.sourceIds.flatMap(i => mapping.get(i) ? [mapping.get(i)!] : []) } : undefined };
  });
}
