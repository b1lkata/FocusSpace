import type { Command } from '../shared/bridge';
export async function call<T = unknown>(command: Command): Promise<T> {
  if (!window.focusspace) throw new Error('Open FocusSpace in the desktop app to use saved workspaces and browsing.');
  const reply = await window.focusspace.call(command);
  if (!reply.ok) throw new Error(reply.error);
  return reply.data as T;
}
