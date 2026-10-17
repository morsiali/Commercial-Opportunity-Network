# Pilot validation checklist

These are **business validation tasks**. A dashboard existing does not answer any of them. Each row needs real pilot data, with sample and simulated records excluded (that is the platform default). Record the evidence and the decision for each.

The operations workspace has the same checklist with editable notes. Its unit-economics panel uses the formulas in `dist/assets/js/core/econ.js`. Every input there is an assumption until real data replaces it.

| # | Question | How to measure | Pass threshold (agree before the pilot) | Evidence | Decision |
|---|---|---|---|---|---|
| 1 | Will buyers pay the platform fee? | Share of approved offers that reach paid checkout; buyer interviews after the quote | | | |
| 2 | Do buyers come back? | Paid buyers with a second paid RFQ within 90 days | | | |
| 3 | Do suppliers respond? | Share of RFQ lines answered before the deadline; median time to answer | | | |
| 4 | Is availability accurate? | Share of offered dates still available at checkout; supplier-side cancellations | | | |
| 5 | Does it save buyers time? | Self-reported hours from brief to booking, compared with their current process | | | |
| 6 | What does support cost? | Operations minutes per booking (verification, nudges, disputes) multiplied by the loaded cost | | | |
| 7 | Is contribution positive? | Fees earned − refunds − processing − support, per paid transaction | | | |
| 8 | Is the fee level right? | Win/loss reasons; sensitivity of conversion to price | | | |
| 9 | Are refunds and disputes manageable? | Refund rate, dispute rate, cost per dispute | | | |

## Professional sign-offs required before live payments

- [ ] Tax treatment of the fee and the supplier VAT (`docs/TAX_AND_FEES.md`) — accountant
- [ ] Terms of service, privacy notice and data processing under UAE PDPL — lawyer
- [ ] Whether holding customer funds before payout needs a licence or an escrow partner — regulatory adviser
- [ ] The supplier licence review policy: which authorities and licence types are accepted, and how often they are re-checked — operations and legal
- [ ] Payment gateway, payout rail, notification and malware-scanning contracts (`docs/PROVIDERS.md`)

## Kill criteria

The operations workspace gives a GO / NO-GO reading from these checks. It is an aid to discussion, not a decision, and the pilot owners agree on the thresholds above before data collection starts.
