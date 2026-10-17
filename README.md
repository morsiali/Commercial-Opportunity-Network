# Commercial Opportunity Network

A website, a demo platform and a live-mode API for an AI-assisted commercial opportunity and procurement platform for the UAE, with a Dubai pilot. English and Arabic are both supported, with a full right-to-left layout.

> **Status:** a corrected demo plus a locally runnable live-mode API implementation. It is **not** a verified live service: nothing is deployed, no payment, payout or notification provider is connected, and legal and tax review is outstanding. See `docs/LIMITATIONS.md`.

## What is here

| Path | What it is |
|---|---|
| `dist/index.html` | Marketing site: brief wizard, how it works, matching demo, pricing (fee and VAT from configuration), FAQ, and early access (prepares an email; nothing is sent or stored) |
| `dist/workflow.html` | Interactive project workflow: 12 project steps shown as 16 playback positions |
| `dist/platform.html` | **Demo mode** platform with buyer, supplier and operations workspaces. It uses labelled sample data and simulated payments and replies, and stores data in this browser only. |
| `dist/privacy.html`, `dist/terms.html` | Prototype notices, with separate data-deletion controls on `privacy.html#your-data` |
| `dist/assets/js/core/` | Shared domain core: money, dates, parser, state machines, inventory, offers, domain operations, migrations. The browser and the API both use it. |
| `server/` | **Live mode** API on Node, with PostgreSQL storage and adapters for providers |
| `tests/` | Unit, API, PostgreSQL, browser, accessibility, keyboard and performance tests |
| `docs/` | Issue register, architecture, modes, providers, tax and fees, parser, checklists, results, screenshots and evidence |

## Requirements

- Node **20.11 or newer**.
- Chromium for the browser tests. Playwright downloads it with `npx playwright install chromium`, or you can set `CHROMIUM_PATH`.
- PostgreSQL 16 for live mode and `test:pg`. This is optional for development.

## Run the demo site

```bash
npm install
npm run preview            # http://127.0.0.1:4176  (PORT=… to change)
```

The demo needs no server-side services. **"Your data"** in the platform header opens the controls to reset the sample data, delete drafts or clear everything this site stored. The privacy page (`privacy.html#your-data`) also deletes early-access details left by older versions.

## Run the live-mode API locally

```bash
cp .env.example .env       # then edit .env; never commit it
# at minimum set AUTH_SECRET (e.g. `openssl rand -base64 48`)
# optional: DATABASE_URL=postgres://user:pass@localhost:5432/con   (otherwise in-memory, development only)
# optional: PRIVATE_STORAGE_DIR, OPS_BOOTSTRAP_EMAIL / OPS_BOOTSTRAP_PASSWORD for the first operations account
node --env-file=.env server/index.mjs
curl -s http://127.0.0.1:8787/api/health
```

Providers you have not configured return **503 not configured**, and `GET /api/health` shows what is configured. To connect real providers, see `docs/PROVIDERS.md`.

## Tests

```bash
npm test                   # static checks + 50 unit tests + 9 API tests
PG_TEST_URL=postgres://postgres@localhost:5432/con_test npm run test:pg   # disposable database only
npm run test:e2e           # browser acceptance flows (Chromium)
npm run test:a11y          # axe-core scan, EN + AR
npm run test:keyboard      # scripted keyboard walk, EN + AR
npm run test:all           # all of the above except test:pg
npm run repro:after        # audit reproductions against the current code
npm run perf               # local load-time baseline (not Lighthouse)
npm run screens            # refresh docs/screenshots/after-*.png
npm run sync-copy          # mirror dist/ into dist/Commercial-Opportunity-Network-1/ (noindex)
```

The latest results are in `docs/TEST_RESULTS.md`, and the raw output is in `docs/evidence/`.

## Configuration

- **Contact email, platform fee and VAT:** `CON.config` in `dist/assets/js/common.js`. Rates are set as `platformFeeBps` and `vatBps`. They are working assumptions until an accountant confirms them; see `docs/TAX_AND_FEES.md`.
- **Matching:** eligibility rules and factor weights are in `dist/assets/js/engine.js`, and listings are in `dist/assets/js/data.js`.
- **Server:** environment variables only; see `.env.example`.

## Documentation

- `docs/ISSUES.md`: the issue register, with reproduction, root cause, fix, verification and status for every finding
- `docs/ARCHITECTURE.md`, `docs/MODES.md`: layers, invariants, concurrency, migrations, and the boundary between demo and live
- `docs/PROVIDERS.md`, `docs/BACKUP_RESTORE.md`: provider setup, and backup and restore
- `docs/TAX_AND_FEES.md`, `docs/PARSER.md`: money rules and the supported input formats
- `docs/MANUAL_CHECKLIST.md`, `docs/PILOT_VALIDATION.md`: checks that need a person, and business validation
- `docs/TEST_RESULTS.md`, `docs/LIMITATIONS.md`: what ran and the results, plus what still blocks launch
- `docs/screenshots/`: before and after screenshots of the screens that changed materially

## Data migration

Data stored by the previous version (`con.state.v2`) is migrated in the browser to `con.state.v3`:

- Records you created are kept.
- Unsafe states are re-opened.
- The v2 copy is left in place for rollback.

Details are in `docs/ARCHITECTURE.md`.
