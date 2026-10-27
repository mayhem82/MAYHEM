import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json' };
const allowed = new Set(['/index.html', '/styles.css', '/src/app.mjs', '/src/engine.mjs', '/src/data-store.mjs', '/src/gauge.mjs', '/src/noaa.mjs', '/src/noaa-parser.mjs', '/data/indicators.json']);
http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const resource = pathname === '/' ? '/index.html' : pathname;
    if (!allowed.has(resource)) { res.writeHead(404); return res.end('Not found'); }
    const content = await readFile(path.join(root, resource));
    res.writeHead(200, { 'Content-Type': `${types[path.extname(resource)]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://gml.noaa.gov; img-src 'self'; frame-ancestors 'none'; base-uri 'self'" });
    res.end(content);
  } catch { res.writeHead(500); res.end('Unable to read local file'); }
}).listen(port, '127.0.0.1', () => console.log(`World in motion: http://127.0.0.1:${port}`));
