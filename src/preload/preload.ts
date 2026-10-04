import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge, Event } from '../shared/bridge';
const bridge: Bridge = {
  call: command => ipcRenderer.invoke('focusspace:command', command),
  subscribe: listener => { const handler = (_event: unknown, data: Event) => listener(data); ipcRenderer.on('focusspace:event', handler); return () => { ipcRenderer.removeListener('focusspace:event', handler); }; },
};
contextBridge.exposeInMainWorld('focusspace', bridge);
