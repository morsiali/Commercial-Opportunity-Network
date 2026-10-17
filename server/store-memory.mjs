// In-process store: one state document, writes serialised by a promise queue.
// Optional DATA_FILE persistence (atomic write via rename). Suitable for development and tests only.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { Domain } from './core.mjs';

export function memoryStore(opts) {
  const file = opts && opts.file;
  let state = null;
  let queue = Promise.resolve();
  const clone = x => JSON.parse(JSON.stringify(x));
  async function persist() { if (!file) return; const tmp = file + '.tmp'; await writeFile(tmp, JSON.stringify(state)); await rename(tmp, file); }
  return {
    kind: file ? 'memory+file' : 'memory',
    async init() {
      if (file) { try { state = JSON.parse(await readFile(file, 'utf8')); } catch { state = null; } }
      if (!state) state = Domain.ensureState({ version: 3, mode: 'live', createdAt: new Date().toISOString(), users: [], orgs: [], memberships: [], documents: [], compare: [], events: [], kill: {} });
      Domain.ensureState(state);
      ['users', 'orgs', 'memberships', 'documents'].forEach(k => { if (!Array.isArray(state[k])) state[k] = []; });
    },
    /* Exclusive read-modify-write. fn may be async only before it touches the state. */
    transact(fn) {
      const run = queue.then(async () => {
        const working = clone(state);
        const value = await fn(working);
        state = working;
        await persist();
        return value;
      });
      queue = run.catch(() => {});
      return run;
    },
    async read(fn) { await queue; return fn(state); },
    async close() { await queue; }
  };
}
