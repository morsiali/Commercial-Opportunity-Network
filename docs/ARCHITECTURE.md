# Architecture

The project keeps its original shape: a static website and platform in `dist/` (vanilla JavaScript, no build step, English and Arabic) that GitHub Pages can serve. Two things were added to it:

- **A shared domain core.** The browser demo and the Node API both load the same files from `dist/assets/js/core/`.
- **A live-mode API** in `server/`. It uses `node:http` with no framework. PostgreSQL is used in production, and an in-memory store is used for development.

The specification suggests TypeScript as a reasonable default. We did not convert. The working code is plain JavaScript, and rule 3 ("do not rewrite working code merely to change frameworks") takes precedence. The domain modules validate their inputs at runtime and return structured errors instead.

## Layers

```
dist/                      static site + demo platform (GitHub Pages)
  assets/js/core/          shared domain core (UMD on globalThis.CON; runs in browser and Node)
    money.js               integer fils, per-line half-up rounding, fee/VAT policy
    dates.js               ISO dates in Asia/Dubai, ranges, weekdays
    parse.js               deterministic requirement extraction (EN/AR), statuses per field
    states.js              state machines + DomainError + audit entries
    inventory.js           date-specific capacity, expiring holds, atomic multi-line holds
    offers.js              versioned offers, content hash, deviations, approval/checkout validation
    domain.js              all commercial operations (listing, RFQ, offer, approve, checkout,
                           payment events, booking, delivery, disputes, refunds, payouts,
                           verification) with authorisation by role and organisation
    migrate.js             versioned migration of stored state (v2 → v3)
    seed.js                demo records built through the same domain operations
    econ.js                unit economics (break-even, payback, refunds)
  assets/js/engine.js      two-stage matching: eligibility, then preference scoring
  assets/js/store.js       demo store (localStorage con.state.v3, drafts con.draft.*)
  assets/js/app*.js, views-*.js   demo UI
server/                    live-mode API
  app.mjs                  routes, validation, auth checks, provider calls
  auth.mjs                 scrypt password hashes, HMAC-signed tokens
  adapters.mjs             payments, payouts, notifications, malware scan, private documents
  store-memory.mjs         development store (serial promise queue; optional JSON file)
  store-postgres.mjs       PostgreSQL store (row lock per transaction, append-only audit table)
  migrations/001_init.sql
tests/                     unit, API, PostgreSQL, browser, accessibility, keyboard, performance
```

## Key invariants and where they are enforced

| Invariant | Enforced in | Tested by |
|---|---|---|
| Money is integer fils, and totals are the sum of rounded lines | `money.js` (throws `MONEY_NOT_MINOR`) | `tests/unit/money.test.mjs` |
| Eligibility failures are never ranked | `engine.js` stage 1 | `tests/unit/engine.test.mjs` |
| Approval belongs to one offer version and its hash | `offers.js` `approvalValid` | domain tests, e2e A08 |
| Expired, past, non-overlapping, unavailable or unaccepted-deviation offers are refused | `offers.js` `validate` (at approval and at checkout) | domain tests, e2e A07 and A14 |
| Capacity is per date; holds are atomic and expire | `inventory.js` | domain and API concurrency tests |
| One checkout per idempotency key; approvals are consumed | `domain.js` `checkout` | domain, API and e2e A10–A11 |
| Payment events are de-duplicated, amount-checked and signed (live) | `domain.js` `paymentEvent`, `adapters.mjs` `verifySignature` | domain and API tests |
| Payout release needs five guards | `states.js` payout guards and `domain.js` | domain, API and e2e A12, A17 |
| Referenced listings are archived; records keep snapshots | `domain.js` `removeListing`, `snapshotListing` | domain test, e2e A16 |
| Verification needs a reviewable document and a checklist | `domain.js` `reviewVerification` | domain, API and e2e A15 |
| Every transition is audited; the audit is append-only in PostgreSQL | `states.js` `transition`, SQL trigger | domain and PostgreSQL tests |
| Live requests are authorised by role and organisation on the server | `domain.js` `authorize`/`ownCustomer`, `app.mjs` | API authorisation test |

## Concurrency (live)

`store.transact(fn)` runs `fn` against the whole platform state inside a single transaction.

- In PostgreSQL, the transaction takes `SELECT … FOR UPDATE` on the one `platform_state` row, so writes are serialised.
- In the memory store, the same effect comes from a promise queue.

This is deliberately simple and correct for pilot volumes. The test for two concurrent checkouts of the last unit runs against both stores.

The trade-off is that write throughput is limited to one transaction at a time. If volume needs more, the next step is to split the document into tables keyed by entity, with row-level locks on inventory dates. That change sits behind the `store` interface and does not alter the domain modules.

## Migrations

**Browser.** `con.state.v2` is migrated to `con.state.v3` by `migrate.js`:

- Records the user created are kept.
- Sample records are regenerated.
- Money becomes integer fils.
- Unsafe states are re-opened: a v2 "verified" status with no document goes back to *submitted*, and a v2 payout released without payment goes back to *held*.
- The v2 key is left in place as a rollback copy.

The tests for this are `tests/unit/migrate.test.mjs` and e2e A20.

**Server.** Migrations are numbered SQL files in `server/migrations/`, applied at start-up and recorded in `schema_migrations`.
