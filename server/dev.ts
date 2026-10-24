import { createServer } from 'node:http';
import { config } from 'dotenv';
import type { ApiHandler } from '../lib/http.js';
import analyze from '../api/analyze.js';
import admin from '../api/admin.js';
import appConfig from '../api/config.js';
import me from '../api/me.js';
import google from '../api/auth/google.js';
import logout from '../api/auth/logout.js';
import { configuredProvider } from '../lib/reasoning.js';

config({ path: '.env.local' });
config({ path: '.env' });
const port = Number(process.env.PORT || 8787);
// Mirrors Vercel's file-based routing under api/.
const routes: Record<string, ApiHandler> = {
  '/api/analyze': analyze, '/api/admin': admin, '/api/config': appConfig, '/api/me': me,
  '/api/auth/google': google, '/api/auth/logout': logout,
};
createServer((req, res) => {
  const path = (req.url || '').split('?')[0];
  const handler = routes[path];
  if (handler) { void handler(req, res); return; }
  if (path === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, provider: configuredProvider() }));
    return;
  }
  res.writeHead(404); res.end('Not found');
}).listen(port, '127.0.0.1', () => console.log(`PATTERN-FORMER API listening on localhost:${port}`));
