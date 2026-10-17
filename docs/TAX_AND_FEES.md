# Fees, VAT and rounding

> **These are working assumptions for the prototype, not tax advice.** A UAE-registered tax agent or accountant must confirm them before any live transaction (L2 in `docs/ISSUES.md`).

## Configuration

The values live in one place, `CON.config` in `dist/assets/js/common.js`. They are shown on the site through `data-fee`/`data-vat`, so the copy never hard-codes a percentage, and the server reads the same defaults (`GET /api/health` reports them).

| Setting | Default | Meaning |
|---|---|---|
| `platformFeeBps` | 700 (7.00%) | Platform fee, charged on the supplier net amount of each line |
| `vatBps` | 500 (5.00%) | The UAE standard VAT rate at the time of writing. Check the current rate. |
| `vatOnPlatformFee` | true | The platform charges VAT on its own fee |
| supplier `vatRegistered` | per offer | VAT is added to the supplier amount only if the supplier says it is VAT-registered |
| `budgetIncludesVat` | false | Budgets are compared excluding VAT |
| `budgetIncludesPlatformFee` | true | Budgets are compared including the platform fee |

## Calculation

All amounts are integers in fils (AED × 100), calculated in `dist/assets/js/core/money.js`.

For each line:

```
net        = basePrice + setupFee                        (fils, from the offer)
fee        = round_half_up(net × platformFeeBps / 10000)
vatSupplier = supplierVatRegistered ? round_half_up(net × vatBps / 10000) : 0
vatFee     = vatOnPlatformFee ? round_half_up(fee × vatBps / 10000) : 0
total      = net + fee + vatSupplier + vatFee
```

Order totals are the **sum of the rounded lines**, and are never recalculated from summed nets. This keeps the order total equal to its lines in both languages.

Worked example (from the reproduction script): net 100,030 fils (AED 1,000.30) gives a fee of 7,002, VAT of 5,352 (5,002 + 350), and a total of 112,384 (AED 1,123.84).

## Supplier liability and platform revenue

| Figure | Definition |
|---|---|
| Supplier liability | net + vatSupplier for paid bookings, until the payout is released |
| Fee earned | fee on bookings that have been delivered and accepted |
| Fee collected | fee on payments received |
| Platform VAT payable | vatFee on payments received |

Questions the accountant must answer:

1. Does the platform act as **agent** (the supplier's VAT passes through as a disbursement) or as **principal** (the platform re-supplies the service and charges VAT on the full amount)? The current model assumes agent.
2. Is VAT due on the fee when the customer is outside the UAE? Zero-rating and place-of-supply rules apply.
3. Who issues the tax invoice for the supplier portion, and how is a supplier without VAT registration documented?
4. How are partial refunds split between the supplier VAT and the fee VAT?
5. Do card processing costs change the fee basis? Processing costs are currently a unit-economics assumption only.
