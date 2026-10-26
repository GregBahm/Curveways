import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/game.js': 'game.js', '/geometry.js': 'geometry.js', '/sphere-game.js': 'sphere-game.js', '/sphere-view.js': 'sphere-view.js', '/sphere-geometry.js': 'sphere-geometry.js', '/three/three.module.js': 'node_modules/three/build/three.module.js', '/three/three.core.js': 'node_modules/three/build/three.core.js' };
http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  try {
    const data = await readFile(new URL(file, import.meta.url));
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  } catch { res.writeHead(500); res.end('Unable to load file'); }
}).listen(3000, '127.0.0.1', () => console.log('Open http://localhost:3000'));
