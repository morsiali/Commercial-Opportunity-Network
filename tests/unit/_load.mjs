// Loads the browser modules into Node in the same order as the pages do.
export const ORDER = ['core/dates', 'core/money', 'core/states', 'core/migrate', 'data', 'core/parse', 'engine', 'core/inventory', 'core/offers', 'core/domain', 'core/seed'];
for (const f of ORDER) await import(new URL('../../dist/assets/js/' + f + '.js', import.meta.url));
export const CON = globalThis.CON;
export const clone = x => JSON.parse(JSON.stringify(x));
