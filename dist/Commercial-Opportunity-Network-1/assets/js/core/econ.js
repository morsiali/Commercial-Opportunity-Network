/* Unit economics model (planning assumptions, not results). Shared by the operations view and the tests.
   Transaction value (atv) is the supplier net per transaction, excluding VAT and the platform fee —
   the same basis the dashboards use for average transaction value and take rate. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const SCENARIOS = {
    stress: { atv: 8000, take: 5, proc: 2.5, ai: 15, support: 350, refunds: 4, fixed: 60000, cac: 6000, freq: 2 },
    conservative: { atv: 15000, take: 7, proc: 2.5, ai: 10, support: 250, refunds: 2, fixed: 45000, cac: 4000, freq: 3 },
    base: { atv: 25000, take: 8, proc: 2.2, ai: 8, support: 180, refunds: 1, fixed: 45000, cac: 3000, freq: 4 }
  };
  /* Per transaction: revenue = atv × take%; variable cost = processing% of the amount charged (atv + fee)
     + AI/tools + support + refund and dispute losses (% of atv). */
  function calc(v) {
    const fee = v.atv * v.take / 100;
    const charged = v.atv + fee;
    const varCost = charged * v.proc / 100 + v.ai + v.support + v.atv * (v.refunds || 0) / 100;
    const contrib = fee - varCost;
    return {
      rev: fee, varCost, contrib, margin: fee ? contrib / fee : 0,
      breakEven: contrib > 0 ? Math.ceil(v.fixed / contrib) : null,              // transactions per month to cover fixed costs
      payTx: contrib > 0 ? v.cac / contrib : null,                                // transactions to recover one customer's acquisition cost
      payMonths: contrib > 0 && v.freq > 0 ? (v.cac / contrib) / (v.freq / 12) : null, // months, at freq transactions per customer per year
      yearContrib: contrib * v.freq - v.cac                                       // first-year contribution per customer after acquisition cost
    };
  }
  CON.Econ = { SCENARIOS, calc };
})(typeof window !== 'undefined' ? window : globalThis);
