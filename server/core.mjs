// Loads the shared domain modules (the same files the browser demo uses) into this process.
// The server never loads the demo seed or the demo store.
const ORDER = ['common', 'core/dates', 'core/money', 'core/states', 'core/migrate', 'data', 'core/parse', 'engine', 'core/inventory', 'core/offers', 'core/domain'];
if (!globalThis.CON || !globalThis.CON.Domain) {
  // common.js expects a browser; give it an inert storage so it loads without touching anything.
  if (!globalThis.localStorage) globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
  for (const f of ORDER) await import(new URL('../dist/assets/js/' + f + '.js', import.meta.url));
}
export const CON = globalThis.CON;
export const { Domain, Engine, Money, Dates, States, Offers, Inventory } = CON;
