/* Commercial Opportunity Network — money module.
   All amounts are integers in fils (1 AED = 100 fils). No floating-point arithmetic on money.
   Rounding rule: percentages are applied per line and rounded half-up to the nearest fil.
   Tax and fee assumptions are documented in docs/TAX_AND_FEES.md and must be confirmed by an accountant. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};

  class MoneyError extends Error { constructor(code, message) { super(message || code); this.code = code; } }

  const MINOR = 100;
  const DEFAULTS = {
    platformFeeBps: 700,          // 7.00% platform fee on supplier net (configurable)
    vatBps: 500,                  // UAE standard VAT rate 5% (verify before live use)
    vatOnPlatformFee: true,       // assumption: the platform charges VAT on its fee
    budgetIncludesVat: false,     // budgets are compared excluding VAT
    budgetIncludesPlatformFee: true // budgets are compared including the platform fee
  };

  function isMinor(v) { return Number.isSafeInteger(v); }
  function assertMinor(v, label) {
    if (!isMinor(v)) throw new MoneyError('MONEY_NOT_MINOR', (label || 'amount') + ' must be an integer number of fils');
    return v;
  }

  /* Parse a normalised decimal string ("1500.5", "20000") into fils. Rejects >2 decimals, negatives, non-numbers. */
  function fromDecimalString(s) {
    const str = String(s).trim();
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(str);
    if (!m) throw new MoneyError('MONEY_PARSE', 'Not a valid amount: ' + str);
    const whole = BigInt(m[1]);
    const frac = BigInt((m[2] || '').padEnd(2, '0') || '0');
    const v = whole * 100n + frac;
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError('MONEY_RANGE', 'Amount too large');
    return Number(v);
  }
  /* AED number (from a form field) to fils, via its decimal string so 1.005 cannot drift. */
  function fromAED(n) {
    if (typeof n === 'string') return fromDecimalString(n.replace(/,/g, ''));
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new MoneyError('MONEY_PARSE', 'Not a valid amount');
    const s = n.toString();
    if (/e/i.test(s)) throw new MoneyError('MONEY_RANGE', 'Amount out of range');
    return fromDecimalString(s);
  }
  /* Multiply fils by an integer quantity. */
  function times(minor, qty) {
    assertMinor(minor); if (!Number.isSafeInteger(qty) || qty < 0) throw new MoneyError('MONEY_QTY', 'Quantity must be a whole number');
    const v = BigInt(minor) * BigInt(qty);
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError('MONEY_RANGE', 'Amount too large');
    return Number(v);
  }
  /* Apply basis points (1 bp = 0.01%) with half-up rounding to the fil. */
  function bps(minor, rateBps) {
    assertMinor(minor); if (!Number.isSafeInteger(rateBps) || rateBps < 0) throw new MoneyError('MONEY_RATE', 'Rate must be whole basis points');
    const neg = minor < 0;
    const v = (BigInt(Math.abs(minor)) * BigInt(rateBps) + 5000n) / 10000n;
    return neg ? -Number(v) : Number(v);
  }
  function add() { let t = 0; for (const a of arguments) t += assertMinor(a); return assertMinor(t, 'total'); }
  function sum(list) { return list.reduce((t, a) => t + assertMinor(a), 0); }

  /* One commercial line: supplier base + setup, platform fee, VAT on supplier net (if the supplier is VAT registered) and on the fee. */
  function line(baseMinor, setupMinor, opts) {
    const c = Object.assign({}, DEFAULTS, opts || {});
    const net = add(assertMinor(baseMinor, 'base'), assertMinor(setupMinor || 0, 'setup'));
    const fee = bps(net, c.platformFeeBps);
    const supplierVatRegistered = c.supplierVatRegistered !== false;
    const vatSupplier = supplierVatRegistered ? bps(net, c.vatBps) : 0;
    const vatFee = c.vatOnPlatformFee ? bps(fee, c.vatBps) : 0;
    const vat = vatSupplier + vatFee;
    return { base: baseMinor, setup: setupMinor || 0, net, fee, vatSupplier, vatFee, vat, exVat: net + fee, total: net + fee + vat,
      basis: { feeBps: c.platformFeeBps, vatBps: c.vatBps, vatOnFee: !!c.vatOnPlatformFee, supplierVatRegistered } };
  }
  /* Totals are the sum of rounded lines, so line totals always reconcile with the transaction total. */
  function totals(lines) {
    const k = ['base', 'setup', 'net', 'fee', 'vatSupplier', 'vatFee', 'vat', 'exVat', 'total'];
    const t = {}; k.forEach(x => { t[x] = sum(lines.map(l => l[x])); });
    return t;
  }
  /* Budget comparison following the documented budget policy. */
  function budgetBasis(l, policy) {
    const p = Object.assign({}, DEFAULTS, policy || {});
    return l.net + (p.budgetIncludesPlatformFee ? l.fee : 0) + (p.budgetIncludesVat ? l.vat : 0);
  }

  /* Display: always two decimals, Latin digits in both languages so values are identical. */
  function format(minor, lang, opts) {
    if (minor == null || !Number.isSafeInteger(minor)) return '—';
    const neg = minor < 0; const a = Math.abs(minor);
    const whole = Math.floor(a / MINOR); const frac = String(a % MINOR).padStart(2, '0');
    const w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const showFrac = !(opts && opts.compact && frac === '00');
    const num = (neg ? '-' : '') + w + (showFrac ? '.' + frac : '');
    return lang === 'ar' ? num + ' د.إ' : 'AED ' + num;
  }
  function toDecimalString(minor) { assertMinor(minor); const a = Math.abs(minor); return (minor < 0 ? '-' : '') + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0'); }

  CON.Money = { MoneyError, DEFAULTS, MINOR, isMinor, fromDecimalString, fromAED, times, bps, add, sum, line, totals, budgetBasis, format, toDecimalString };
})(typeof window !== 'undefined' ? window : globalThis);
