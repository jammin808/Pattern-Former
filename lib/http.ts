import type { IncomingMessage, ServerResponse } from 'node:http';

// Compatible with Vercel's Node serverless function convention and the local Node server.
export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiHandler = (req: ApiRequest, res: ServerResponse) => Promise<void>;

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const LIMIT = 140_000;

export async function readBody(req: ApiRequest): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
    throw new HttpError(415, 'Content-Type must be application/json.');
  }
  if (req.body !== undefined) {
    if (JSON.stringify(req.body).length > LIMIT) throw new HttpError(413, 'Request is too large.');
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'Invalid JSON.'); }
    }
    return req.body;
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > LIMIT) throw new HttpError(413, 'Request is too large.');
  }
  try { return JSON.parse(body); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

export function json(res: ServerResponse, code: number, value: unknown): void {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}

// Dispatches by HTTP method and turns thrown errors into safe JSON responses.
export function route(methods: Partial<Record<'GET' | 'POST' | 'PATCH' | 'PUT', ApiHandler>>): ApiHandler {
  return async (req, res) => {
    const handler = methods[req.method as keyof typeof methods];
    if (!handler) { json(res, 405, { error: 'Method not allowed.' }); return; }
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) { json(res, error.status, { error: error.message }); return; }
      // Do not expose provider diagnostics or secret-bearing stack traces to clients.
      console.error('Request failed:', error instanceof Error ? error.name + ': ' + error.message : 'Unknown error');
      json(res, 500, { error: 'Request failed. Check server logs.' });
    }
  };
}
