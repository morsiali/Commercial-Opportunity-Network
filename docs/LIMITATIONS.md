# Known limitations and launch blockers

## What this branch is

- **A corrected demo.** `platform.html` and the site run in the browser with labelled sample data and simulated payments and replies.
- **A locally runnable live-mode API implementation.** `server/` runs with PostgreSQL and the tests pass.

It is **not a verified live service.** Nothing has been deployed, no real provider is connected, and no security or legal review has taken place.

## Launch blockers (all must be cleared before real customers or money)

| # | Blocker | Depends on | Reference |
|---|---|---|---|
| 1 | No payment gateway is integrated | A UAE-licensed gateway contract, sandbox and live credentials | `docs/PROVIDERS.md`, S14c |
| 2 | No payout or escrow rail | Choice of provider, plus the licensing answer on holding funds | S14d, L3 |
| 3 | No notifications (email/SMS) | A provider account | S14e |
| 4 | Malware scanning not exercised | A running clamd and an EICAR test in staging | S14f |
| 5 | The platform UI has no live-mode client | Engineering work. The checkout step also depends on blocker 1. | S14g |
| 6 | No production hosting for the API (TLS, HTTP security headers, backups) | A hosting decision | L5, `docs/BACKUP_RESTORE.md` |
| 7 | Legal review of the terms, the privacy notice and PDPL compliance | A UAE lawyer | L1 |
| 8 | Tax treatment of fees and supplier VAT | An accountant | L2, `docs/TAX_AND_FEES.md` |
| 9 | Supplier licence review policy | Operations and legal | L4 |
| 10 | Independent security review and penetration test of the API | A reviewer | S14b |
| 11 | Manual keyboard, screen-reader and phone checks | A person | `docs/MANUAL_CHECKLIST.md` |

## Engineering limitations, by design for the pilot

- **Write throughput.** The live store serialises writes through one row lock. This is correct, but limits throughput (`docs/ARCHITECTURE.md`).
- **No TypeScript, linter or type checker.** The code validates its inputs at runtime and the tests cover the invariants.
- **Parser coverage.** Hijri dates, other currencies and spelled-out numbers are not recognised and must be entered by hand (`docs/PARSER.md`).
- **Demo storage is per browser.** Clearing browser data removes it.
- **Interrupted payouts.** A payout interrupted between the provider transfer and the record stays `releasing` until it is reconciled by hand.
- **Arabic copy.** It was written for the prototype and has not been reviewed by a native-speaking editor.
- **Performance.** Figures are local lab measurements only (`docs/TEST_RESULTS.md`).

## Business validation (not resolved by code)

See `docs/PILOT_VALIDATION.md`. That covers willingness to pay, repeat purchases, supplier response, availability accuracy, time saved, support cost, contribution margin, the fee level, and refund and dispute cost. Reducing the repetitive homepage copy is also an editorial decision.
