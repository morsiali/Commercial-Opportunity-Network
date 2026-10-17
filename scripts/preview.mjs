// Local preview server: npm run preview  →  http://127.0.0.1:4176
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'dist');
const types = { '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      // Same paths as GitHub Pages: the site lives under /Commercial-Opportunity-Network/
      const pathname = url.pathname.replace(/^\/Commercial-Opportunity-Network(?=\/|$)/, '') || '/';
      let path = normalize(join(root, decodeURIComponent(pathname === '/' ? 'index.html' : pathname)));
      if (!path.startsWith(normalize(root))) throw new Error('Invalid path');
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      // Like GitHub Pages: unknown paths get the site's 404 page
      try { const body = await readFile(join(root, '404.html')); res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
      catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('preview.mjs')) {
  const port = Number(process.env.PORT) || 4176;
  createServer().listen(port, '127.0.0.1', () => console.log(`Commercial Opportunity Network → http://127.0.0.1:${port}`));
}
