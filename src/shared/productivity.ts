import { aiResultSchema, type AIResult } from './bridge';
import { createCard, record, type Position, type Workspace } from './model';
import { nextCardPosition } from './spatial';
export type LayoutSnapshot = { cardId: string; position: Position }[];
export function applyOrganization(workspace: Workspace, raw: AIResult): LayoutSnapshot {
  const result = aiResultSchema.parse({ text: raw.text, tasks: raw.tasks, positions: raw.positions });
  if (new Set(result.positions.map(p => p.cardId)).size !== result.positions.length || result.positions.some(p => !workspace.cards.some(c => c.id === p.cardId))) throw new Error('Invalid organization references. Nothing was applied.');
  const previous = workspace.cards.map(c => ({ cardId: c.id, position: [...c.position] as Position }));
  for (const p of result.positions) workspace.cards.find(c => c.id === p.cardId)!.position = p.position;
  record(workspace, 'organized', 'Accepted organization suggestion'); return previous;
}
export function undoOrganization(workspace: Workspace, snapshot: LayoutSnapshot): void {
  for (const p of snapshot) { const c = workspace.cards.find(c => c.id === p.cardId); if (c) c.position = p.position; }
  record(workspace, 'organization-undone', 'Undid organization');
}
export function addTaskDrafts(workspace: Workspace, titles: string[]): number {
  const validated = titles.map(t => t.trim()).filter(Boolean);
  if (validated.length > 20 || validated.some(t => t.length > 200)) throw new Error('Task drafts are too long.');
  let count = 0;
  for (const title of validated) if (!workspace.cards.some(c => c.kind === 'task' && c.title.trim().toLowerCase() === title.toLowerCase())) {
    if (workspace.cards.length >= 200) throw new Error('Workspace card limit reached.');
    const card = createCard('task', title, workspace.cards.length); card.position = nextCardPosition(workspace.cards); workspace.cards.push(card); record(workspace, 'task-created', `Created ${title}`, card.id); count++;
  }
  return count;
}
