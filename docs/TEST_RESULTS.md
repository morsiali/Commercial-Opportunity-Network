# Test results

**Run date:** 2026-10-17, on branch `hardening`.

**Environment:** Node 22.22.0, Chromium 141.0.7390.37 through Playwright 1.56.0, axe-core 4.10.3 and PostgreSQL 16.15. Everything ran on a local machine: nothing was deployed and no external service was contacted.

## Commands and results

| Command | What it runs | Result |
|---|---|---|
| `npm test` | `scripts/verify.mjs` checks links, anchors, routes, both languages, dynamic keys, no hard-coded fee/VAT, CSP/canonical/noindex/robots/sitemap/404. It then runs 50 unit tests and 9 API tests. | Static checks pass; **59 / 59 pass** |
| `PG_TEST_URL=… npm run test:pg` | The API against a real PostgreSQL 16 database: migrations, concurrent last-unit checkout, idempotency, append-only audit, document metadata | **1 / 1 pass** |
| `npm run test:e2e` | 27 browser flows (A01–A26 plus A01b) in Chromium, written to `docs/evidence/e2e-results.json` | **27 / 27 pass**, no console errors, no untranslated keys |
| `npm run test:a11y` | axe-core on 13 pages and views × 2 languages, written to `docs/evidence/a11y-axe.json` | **0 violations** in 26 scans (3 consecutive runs) |
| `npm run test:keyboard` | Scripted Tab walk on 10 pages × 2 languages, written to `docs/evidence/keyboard-walk.json` | **20 / 20** pass: skip link first, 1,124 focus stops, all named, visible and with a focus indicator |
| `npm run repro:after` | The audit reproductions against the new code, written to `docs/evidence/repro-after.json` | Every case behaves as specified (see `docs/ISSUES.md`) |
| `npm audit` | Dependency advisories, written to `docs/evidence/npm-audit.json` | 0 vulnerabilities (18 packages) |
| `node --check` on every JS/MJS file | Syntax | Pass |
| `npm run perf` | Local load timings, written to `docs/evidence/perf.json` | See below |

**What was not run**

- There is no linter and no type checker in this project, because it has no TypeScript or ESLint configuration. We did not add one, to keep within rule 3.
- The manual keyboard and screen-reader check in `docs/MANUAL_CHECKLIST.md` has not been done by a person yet.
- No Lighthouse run and no field Core Web Vitals.

## The mandatory acceptance suite (§19)

| # | Requirement | Evidence | Result |
|---|---|---|---|
| 1 | AED 20,000 followed by "men" stays AED 20,000 | U "budget cases from the specification"; R H1 = 2,000,000 fils; E A02, A04 | Pass |
| 2 | Arabic amounts with separators | U budget cases; R H2d = 100,000.00, H2e = 1,500.50 | Pass |
| 3 | Qualified-lead targets | U "the lead target and the budget are not confused"; R H3a = [500, leads]; E A02 | Pass |
| 4 | Negated sampling is not chosen | U "negated objectives are excluded, not selected"; R H3c | Pass |
| 5 | Explicit start dates | U dates test; R H4 = 2026-12-01; E A02 | Pass |
| 6 | Extraction and language changes keep drafts | E A01, A01b, A03 | Pass |
| 7 | Mandatory audience and location mismatches excluded | U H7 test; E A05 | Pass |
| 8 | Unsupported duration never shown as full | U §7 test; R H8 = partial, 60 + 30 uncovered; E A07 | Pass |
| 9 | Totals reconcile to minor units | U money tests (4); R H9; E A10 | Pass |
| 10 | Expired offers cannot be approved or bought | U H10; E A14 | Pass |
| 11 | Material revisions invalidate approval | U H11; E A08 | Pass |
| 12 | Unpaid bookings cannot release payouts | U H12 (domain and migration); S checkout/payout test; E A12 | Pass |
| 13 | Duplicate checkout or payment events | U H13 and payment-event idempotency; S checkout test and signed webhooks; E A10, A11 | Pass |
| 14 | Concurrent reservations within capacity | U H14 and atomic hold; S concurrent checkout (memory store and PostgreSQL); S concurrent payout release | Pass |
| 15 | Archiving keeps history | U H15 and booking snapshot; E A16 | Pass |
| 16 | Verification never from a file name | U H16 and migration downgrade; S documents; E A15 | Pass |
| 17 | Live role and organisation boundaries on the server | S "authorisation: roles and organisations are enforced on every action" | Pass (local; not penetration-tested) |
| 18 | Early-access confirmation matches what happens | E A24 | Pass |
| 19 | Deletion controls match their descriptions | E A19, A25 | Pass |
| 20 | Routes, workflows, EN/AR and mobile | E A21 (360/390/640@200%/768/1024/1440, both languages), A22, all flows; `verify.mjs` | Pass (automated). Manual phone check pending. |
| 21 | Dialogs and tabs by keyboard | E A06, A18; keyboard walk | Pass (automated). Manual check pending. |
| 22 | Demo data never shown as market evidence | U acceptance 22; E A26 | Pass |

Key: U = unit test, S = API test, E = browser test, R = reproduction script.

## Performance baseline (local lab measurement)

Measured in headless Chromium against a local server, with no network throttling and no compression. Each figure is the median of 5 cold loads. These numbers show relative size and are useful for comparing before and after a change. They are **not** Lighthouse scores and **not** field Core Web Vitals.

| Page | Transfer (uncompressed) | Requests | DOMContentLoaded | Load | LCP | DOM nodes |
|---|---|---|---|---|---|---|
| index.html | 273 KB | 16 | 381 ms | 381 ms | 288 ms | 2,097 |
| workflow.html | 176 KB | 12 | 223 ms | 289 ms | 192 ms | 488 |
| privacy.html | 125 KB | 9 | 209 ms | 308 ms | 216 ms | 225 |
| platform.html#c-overview | 648 KB | 28 | 302 ms | 399 ms | 436 ms | 263 |
| platform.html#c-plan-obsample | 643 KB | 28 | 356 ms | 484 ms | 528 ms | 2,382 |

With gzip, the platform's HTML, JS and CSS come to about 187 KB, and the home page's to about 79 KB. GitHub Pages compresses responses.

No optimisation was made, because nothing measured here justified the risk. The largest single files are the two platform string tables (95 KB and 79 KB uncompressed). If a real-network test on a mid-range phone shows a problem, the first step would be to load only the active language.
