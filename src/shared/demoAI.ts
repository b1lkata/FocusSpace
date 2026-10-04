import type { AIResult } from './bridge';
import type { Workspace } from './model';
import { slotPosition } from './spatial';

export function demoResult(kind: string, workspace: Workspace, content: string): AIResult {
  const unfinished = workspace.cards.filter(c => c.kind === 'task' && !c.done);
  const base = { provider: 'demo' as const, tasks: [] as string[], positions: [] as AIResult['positions'] };
  if (kind === 'organize') return { ...base, text: 'Demo suggestion: group websites, notes, and tasks together in an expanding layout. Review before applying.', positions: [...workspace.cards].sort((a, b) => a.kind.localeCompare(b.kind)).map((c, i) => ({ cardId: c.id, position: slotPosition(i) })) };
  if (kind === 'tasks') return { ...base, text: 'Demo task drafts based on the supplied summary. Review and edit before adding.', tasks: ['Review the saved summary and source page', 'Write down the next concrete project step'] };
  if (kind === 'briefing') return { ...base, text: `Recorded facts\n${workspace.leftOff || 'No where-I-left-off note yet.'}\n\nUnfinished tasks\n${unfinished.map(c => `• ${c.title}`).join('\n') || 'No unfinished tasks.'}\n\nRelevant material\n${workspace.cards.filter(c => c.kind !== 'task').slice(0, 6).map(c => `• ${c.title}`).join('\n') || 'No saved material.'}\n\nRecent activity\n${workspace.activity.slice(0, 5).map(a => `• ${a.detail}`).join('\n') || 'No recorded activity.'}\n\nDemo suggested next step\n${unfinished[0] ? `Work on “${unfinished[0].title}”.` : 'Add one concrete task for your next session.'}` };
  return { ...base, text: kind === 'compare' ? `Demo comparison — source excerpts, not live AI analysis\n\n${content.slice(0, 10000)}\n\nSuggested next step: review each source and note differences. Missing content cannot be compared.` : `Demo summary — extractive excerpt, not live AI analysis\n\n${content.slice(0, 2500)}` };
}
