# Demo mode and live mode

The two modes never share a code path for anything that matters commercially. The shared domain core in `dist/assets/js/core/` applies the same rules in both modes. What differs is who the actor is, where data lives, and whether money or messages can move.

| | Demo mode (`platform.html`) | Live mode (`server/` API) |
|---|---|---|
| Where it runs | In the browser only. It works offline and needs no paid services. | A Node 20.11+ server, with PostgreSQL in production. |
| Who you are | You switch between buyer, supplier and operations to try each role. The switcher is labelled as a demo tool and is **not** authorisation. | You are an authenticated user with one role and one organisation. Every sensitive action is checked on the server. |
| Data | Stored in `localStorage` on this device only (`con.state.v3`, `con.draft.*`). Nothing is shared with other users, and the page says so. | Stored in the server database. The audit log is append-only. |
| Sample records | Clearly labelled sample listings, suppliers and RFQs. They are excluded from metrics unless you turn on "include sample". Sample evidence reads "Sample data (illustrative)". | No sample data. |
| Supplier replies | Replies you do not write yourself are simulated and labelled as simulated. No supplier is contacted. | Suppliers reply through the API. |
| Payments | Simulated payment events, labelled as simulated. No money moves. | Through the payment adapter. Without a configured provider, checkout returns **503 not configured** and leaves nothing behind. Client-supplied payment status is never trusted, and only signed webhooks change payment state. |
| Payouts | Simulated release after the same five guards. | Through the payout adapter, after the guards. Returns 503 until a provider is configured. |
| Verification | A labelled sample document and a review checklist. The whole process is marked simulated. Real identity documents are never requested. | A real upload with type and signature checks, private storage, malware scan, ops-only access and an audit entry. A document that has not been scanned cannot be approved. |
| Notifications | None. | Through the notifications adapter. Returns "not configured" until an account exists. |
| Notices | A persistent demo banner on every screen, including small screens. | `GET /api/health` reports `mode: live` and the state of every provider. |

## The rule that keeps them apart

Live mode **never simulates**. Each adapter has a `test` provider, but it only switches on when both `PAYMENT_PROVIDER=test` (or the equivalent) and `NODE_ENV=test` are set. This is so the automated API tests can run. In any other environment, choosing `test` counts as "not configured".

## What is not built yet

The platform UI does not have a live-mode client yet (issue S14g in `docs/ISSUES.md`). The API can be used directly over HTTP, and its contract is exercised by `tests/server/api.test.mjs`.
