// Browser-compatible builds use the local browser adapter, never Electron IPC.
export const isMobileBuild = ['ios', 'android'].includes(import.meta.env.MODE);
export const isPublicDemo = import.meta.env.MODE === 'demo';
export const isWebPreview = ['web-preview', 'demo'].includes(import.meta.env.MODE) || isMobileBuild;
