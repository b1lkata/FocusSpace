import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync } from 'node:fs';
import { emptyState, stateSchema, type AppState } from '../shared/model';

export class Storage {
  private db: DatabaseSync;
  constructor(path: string) {
    const existing = existsSync(path);
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    const version = Number((this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
    if (version > 1) { this.db.close(); throw new Error('This database was created by a newer FocusSpace version. Data was preserved.'); }
    if (version < 1) {
      if (existing) { this.db.exec('PRAGMA wal_checkpoint(FULL)'); copyFileSync(path, `${path}.before-v1.bak`); }
      try { this.db.exec('BEGIN IMMEDIATE; CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); PRAGMA user_version=1; COMMIT;'); }
      catch (error) { this.db.exec('ROLLBACK'); this.db.close(); throw error; }
    }
  }
  load(): AppState {
    const row = this.db.prepare('SELECT json FROM state WHERE id=1').get() as { json: string } | undefined;
    return row ? stateSchema.parse(JSON.parse(row.json)) : emptyState();
  }
  save(state: AppState): void {
    const validated = stateSchema.parse(state);
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.prepare('INSERT INTO state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(JSON.stringify(validated)); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close(): void { this.db.close(); }
}
