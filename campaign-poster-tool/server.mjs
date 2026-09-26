import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const publicDir = join(import.meta.dirname, 'public');
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };

createServer((request, response) => {
  const path = normalize(join(publicDir, request.url === '/' ? 'index.html' : decodeURIComponent(request.url.split('?')[0])));
  if (!path.startsWith(publicDir) || !existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
  createReadStream(path).pipe(response);
}).listen(4173, () => console.log('Poster tool: http://localhost:4173'));
