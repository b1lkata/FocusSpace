import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { Storage } from '../src/main/storage';
import { demoWorkspace, emptyState } from '../src/shared/model';
describe('SQLite persistence and migrations', () => {
  it('migrates a new database and restores project data after reopening', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focusspace-test-')); const path = join(directory, 'data.sqlite');
    try { const store = new Storage(path); const state = emptyState(); const w = demoWorkspace(); w.cards[2].body = 'Edited note'; w.cards[3].done = true; w.cards[0].position = [-8, 0, 6]; state.workspaces.push(w); store.save(state); store.close(); const reopened = new Storage(path); expect(reopened.load()).toEqual(state); reopened.close(); const db = new DatabaseSync(path); expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(1); db.close(); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('preserves the last valid save after validation fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focusspace-test-')); try { const store = new Storage(join(directory, 'data.sqlite')); const state = emptyState(); store.save(state); expect(() => store.save({ ...state, version: 99 } as unknown as typeof state)).toThrow(); expect(store.load()).toEqual(state); store.close(); } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('refuses a newer database without overwriting it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focusspace-test-')); const path = join(directory, 'data.sqlite'); try { const db = new DatabaseSync(path); db.exec('PRAGMA user_version=99'); db.close(); expect(() => new Storage(path)).toThrow('newer'); const check = new DatabaseSync(path); expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(99); check.close(); } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
