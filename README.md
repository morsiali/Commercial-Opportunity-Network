# Commercial Opportunity Network

Website and working platform prototype for an AI-assisted commercial opportunity intelligence and procurement platform for the UAE (Dubai pilot). English and Arabic, with full right-to-left layout.

## What is in `dist/`

| Page | What it does |
|---|---|
| `index.html` | Marketing site in the Wibify design style (Cairo typeface): brief wizard, how it works, opportunity types, live match-score demo, platform modules, suppliers, ground rules, pricing, FAQ, early access, footer |
| `workflow.html` | Interactive project workflow: swimlanes for Brand, Platform, Supplier and Operations, step-by-step player, role filter, step details with links to each screen, status explorer |
| `platform.html` | The working prototype with three workspaces: **Brand**, **Supplier**, **Operations** |
| `privacy.html`, `terms.html` | Prototype privacy notice and terms |

### Platform flow (all working)

Create objective (form or one sentence) → requirements read → ranked opportunity plan with 8 transparent match factors, risks, sources and alternatives → packages within budget (fee on its own line) → schematic Dubai map → compare up to four → one standard RFQ → supplier replies (you can answer as a supplier; others reply automatically, labelled "simulated") → normalised offers (VAT 5%, platform fee 7%, cost per day, date coverage, terms) → approve → checkout (card / bank transfer / invoice, simulated) → booking timeline → supplier results with measurement method → buyer confirms delivery and adds own outcome → operations releases payout.

Supplier workspace: switch supplier, register a new one, add/edit/pause/delete listings with photo upload, CSV import, RFQ inbox and structured replies, booking status and results, licence verification.

Operations workspace: pilot metrics, verification queue, RFQ monitor with nudges, payments and payouts, editable unit economics (stress / conservative / base), kill-criteria tracker with a GO / NO-GO reading.

All demo suppliers, listings and prices are fictional and labelled as illustrative. Data is stored only in the browser (localStorage); "Reset demo" in the platform header restores the sample records.

## Run and test

```bash
npm run preview        # http://127.0.0.1:4176
npm test               # link, route and translation checks + engine unit tests (no install needed)
npm install            # only for the browser test
npx playwright install chromium
npm run test:e2e       # full end-to-end flow in Chromium
```

## Configuration

- Contact email shown on the site: `CON.config.contactEmail` in `dist/assets/js/common.js`.
- Platform fee and VAT: `CON.config.platformFeeRate`, `CON.config.vatRate` in the same file.
- Match-factor weights and objective-fit table: `dist/assets/js/engine.js` and `dist/assets/js/data.js`.

## Structure

```
dist/assets/css/   base.css (tokens), site.css, app.css
dist/assets/js/    common.js, data.js, engine.js, illustrations.js,
                   i18n-site.js, i18n-app.js, store.js,
                   app-core.js, views-customer.js, views-supplier.js, views-ops.js, app.js, site.js, legal.js
scripts/           preview.mjs (static server), verify.mjs (static checks)
tests/             engine.test.mjs (node:test), e2e.mjs (Playwright)
```

Version 1 of the prototype is kept in `legacy-v1/` and in git history.
