import type { CatalogTrack } from './catalogSearch';
export type AudioFile = { id: string; name: string; blob: Blob; catalogId?: number };
export function matchesCatalog(file: AudioFile, track: CatalogTrack) {
  const clean = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const name = clean(file.name); const title = clean(track.trackName); const artist = clean(track.artistName);
  return file.catalogId === track.trackId || name === title || name === artist + title || name === title + artist;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('focusspace.audio.v1', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('files', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Audio storage is busy'));
  });
}
export async function readAudioFiles(): Promise<AudioFile[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').getAll();
      request.onsuccess = () => {
        const items: unknown[] = request.result;
        if (items.length > 200 || !items.every(value => typeof value === 'object' && value !== null && typeof (value as AudioFile).id === 'string' && typeof (value as AudioFile).name === 'string' && (value as AudioFile).blob instanceof Blob)) { reject(new Error('Unreadable audio library')); return; }
        resolve(items as AudioFile[]);
      }; request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function writeAudioFiles(items: AudioFile[], removeId?: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite'); const store = transaction.objectStore('files');
      if (removeId) store.delete(removeId); else for (const item of items) store.put(item);
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
