// Keeps the duplicate site at dist/Commercial-Opportunity-Network-1/ identical to the main site,
// so the established URL keeps working without serving an outdated version.
// The copy is marked noindex and its canonical links point at the main site.
import { readdir, mkdir, copyFile, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
const dist = join(import.meta.dirname, '..', 'dist');
const COPY = 'Commercial-Opportunity-Network-1';
const target = join(dist, COPY);
const SKIP = new Set([COPY, '404.html', 'robots.txt', 'sitemap.xml']);
await rm(target, { recursive: true, force: true });
async function walk(rel) {
  for (const name of await readdir(join(dist, rel))) {
    if (!rel && SKIP.has(name)) continue;
    const r = rel ? join(rel, name) : name;
    if ((await stat(join(dist, r))).isDirectory()) { await mkdir(join(target, r), { recursive: true }); await walk(r); continue; }
    await mkdir(join(target, rel), { recursive: true });
    if (name.endsWith('.html')) {
      let h = await readFile(join(dist, r), 'utf8');
      if (!/name="robots"/.test(h)) h = h.replace('<meta name="referrer"', '<meta name="robots" content="noindex">\n<meta name="referrer"');
      await writeFile(join(target, r), h);
    } else await copyFile(join(dist, r), join(target, r));
  }
}
await walk('');
console.log('Synced copy at dist/' + COPY + '/');
