// Integer-fils money, rounding, VAT/fee lines and display.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CON } from './_load.mjs';
const M = CON.Money;

test('amounts are integer fils and parsing never drifts (H9)', () => {
  assert.equal(M.fromAED(1000.3), 100030);
  assert.equal(M.fromAED('1,500.50'), 150050);
  assert.equal(M.fromAED(0.1) + M.fromAED(0.2), M.fromAED(0.3));
  assert.throws(() => M.fromAED('1.005'), e => e.code === 'MONEY_PARSE');
  assert.throws(() => M.fromAED(-1), e => e.code === 'MONEY_PARSE');
  assert.throws(() => M.add(1.5), e => e.code === 'MONEY_NOT_MINOR');
});

test('percentages round half-up per line and totals equal the sum of lines', () => {
  assert.equal(M.bps(10, 500), 1);   // 0.5 fil → 1
  assert.equal(M.bps(9, 500), 0);    // 0.45 → 0
  const lines = [M.line(33333, 0), M.line(33333, 0), M.line(33334, 0)];
  const t = M.totals(lines);
  assert.equal(t.total, lines.reduce((a, l) => a + l.total, 0));
  assert.equal(t.total, t.net + t.fee + t.vat);
});

test('VAT only applies to the supplier amount when the supplier is VAT registered', () => {
  const a = M.line(1000000, 0, { supplierVatRegistered: true });
  const b = M.line(1000000, 0, { supplierVatRegistered: false });
  assert.equal(a.vatSupplier, 50000); assert.equal(b.vatSupplier, 0);
  assert.equal(a.fee, 70000); assert.equal(a.vatFee, 3500);
  assert.equal(M.line(1000000, 0, { platformFeeBps: 1000 }).fee, 100000);
});

test('budget comparison follows the documented policy', () => {
  const l = M.line(1000000, 0);
  assert.equal(M.budgetBasis(l), 1070000);
  assert.equal(M.budgetBasis(l, { budgetIncludesVat: true }), l.total);
  assert.equal(M.budgetBasis(l, { budgetIncludesPlatformFee: false }), 1000000);
});

test('display uses two decimals in both languages', () => {
  assert.equal(M.format(150050, 'en'), 'AED 1,500.50');
  assert.equal(M.format(150050, 'ar'), '1,500.50 د.إ');
  assert.equal(M.format(null, 'en'), '—');
});
