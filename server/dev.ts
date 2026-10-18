import { createServer } from 'node:http';
import { config } from 'dotenv';
import handler from '../api/analyze.js';
import { configuredProvider } from '../lib/reasoning.js';

config({ path: '.env.local' });
config({ path: '.env' });
const port = Number(process.env.PORT || 8787);
createServer((req, res) => {
  if (req.url === '/api/analyze') { void handler(req, res); return; }
  if (req.url === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, provider: configuredProvider() }));
    return;
  }
  res.writeHead(404); res.end('Not found');
}).listen(port, '127.0.0.1', () => console.log(`PATTERN-FORMER API listening on localhost:${port}`));
