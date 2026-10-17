// Live-mode API server. Configure with environment variables (see .env.example); no secrets in code.
import { createApp } from './app.mjs';
import { memoryStore } from './store-memory.mjs';

const env = process.env;
const store = env.DATABASE_URL
  ? await (await import('./store-postgres.mjs')).postgresStore({ url: env.DATABASE_URL, ssl: env.DATABASE_SSL === '1' })
  : memoryStore({ file: env.DATA_FILE });
await store.init();
const app = createApp({ store, env });
if (await app.bootstrapOps()) console.log('Created the first operations account from OPS_BOOTSTRAP_EMAIL. Remove OPS_BOOTSTRAP_PASSWORD from the environment now.');
const port = Number(env.PORT || 8787), host = env.HOST || '127.0.0.1';
app.server().listen(port, host, () => console.log(`API (live mode, ${store.kind} storage) → http://${host}:${port}/api/health`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await store.close(); process.exit(0); });
