import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

// Loaded via getBuiltinModule because Vite (vitest) mangles a static `node:sqlite` import.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

export interface Cache {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown, ttlMs: number): void;
  close(): void;
}

export interface CacheOptions {
  /** SQLite file path, or omit for memory only. */
  dbPath?: string;
  maxMemoryEntries?: number;
  now?: () => number;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

/** Two-level cache: bounded in-memory Map (insertion order as LRU) over an optional SQLite file. */
export function createCache(opts: CacheOptions = {}): Cache {
  const now = opts.now ?? Date.now;
  const max = opts.maxMemoryEntries ?? 5000;
  const memory = new Map<string, Entry>();

  const db: DatabaseSyncType | undefined = opts.dbPath ? new DatabaseSync(opts.dbPath) : undefined;
  db?.exec('PRAGMA journal_mode = WAL');
  db?.exec('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL)');
  const selectStmt = db?.prepare('SELECT value, expires_at FROM cache WHERE key = ?');
  const upsertStmt = db?.prepare(
    'INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at',
  );
  const deleteStmt = db?.prepare('DELETE FROM cache WHERE key = ?');

  function remember(key: string, entry: Entry) {
    memory.delete(key);
    memory.set(key, entry);
    if (memory.size > max) memory.delete(memory.keys().next().value!);
  }

  return {
    get<T>(key: string): T | undefined {
      const hit = memory.get(key);
      if (hit) {
        if (hit.expiresAt > now()) {
          remember(key, hit);
          return hit.value as T;
        }
        memory.delete(key);
      }
      const row = selectStmt?.get(key) as { value: string; expires_at: number } | undefined;
      if (!row) return undefined;
      if (row.expires_at <= now()) {
        deleteStmt?.run(key);
        return undefined;
      }
      const value = JSON.parse(row.value) as T;
      remember(key, { value, expiresAt: row.expires_at });
      return value;
    },
    set(key, value, ttlMs) {
      const expiresAt = now() + ttlMs;
      remember(key, { value, expiresAt });
      upsertStmt?.run(key, JSON.stringify(value), expiresAt);
    },
    close() {
      db?.close();
    },
  };
}
