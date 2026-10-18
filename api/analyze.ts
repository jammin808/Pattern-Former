import type { IncomingMessage, ServerResponse } from 'node:http';
import { analysisRequestSchema } from '../lib/schema';
import { runAnalysis } from '../lib/reasoning';

// Compatible with Vercel's Node serverless function convention and the local Node server.
type ApiRequest = IncomingMessage & { body?: unknown };
const LIMIT = 140_000;

async function readBody(req: ApiRequest): Promise<unknown> {
  if (req.body !== undefined) {
    if (JSON.stringify(req.body).length > LIMIT) throw new Error('PAYLOAD_TOO_LARGE');
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { throw new Error('INVALID_JSON'); }
    }
    return req.body;
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > LIMIT) throw new Error('PAYLOAD_TOO_LARGE');
  }
  try { return JSON.parse(body); } catch { throw new Error('INVALID_JSON'); }
}

function json(res: ServerResponse, code: number, value: unknown): void {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}

export default async function handler(req: ApiRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed.' }); return; }
  if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
    json(res, 415, { error: 'Content-Type must be application/json.' }); return;
  }
  if (!process.env.GEMINI_API_KEY) {
    json(res, 503, { error: 'Server is not configured with GEMINI_API_KEY.' }); return;
  }
  try {
    const body = await readBody(req);
    const parsed = analysisRequestSchema.safeParse(body);
    if (!parsed.success) {
      json(res, 400, { error: 'Invalid request.', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
      return;
    }
    const result = await runAnalysis(parsed.data, process.env.GEMINI_API_KEY);
    json(res, 200, result);
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
      json(res, 413, { error: 'Request is too large.' });
    } else if (error instanceof Error && error.message === 'INVALID_JSON') {
      json(res, 400, { error: 'Invalid JSON.' });
    } else {
      // Do not expose model/provider diagnostics or secret-bearing stack traces to clients.
      console.error('Analysis failed:', error instanceof Error ? error.name + ': ' + error.message : 'Unknown error');
      json(res, 502, { error: 'Analysis failed. Check server logs and model configuration.' });
    }
  }
}
