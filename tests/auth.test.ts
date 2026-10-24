import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT } from 'jose';
import { requireUser } from '../lib/auth';
import { HttpError, type ApiRequest } from '../lib/http';

process.env.SESSION_SECRET = 'x'.repeat(40);
const request = (cookie?: string) => ({ headers: cookie ? { cookie } : {} }) as ApiRequest;
const rejectsWith = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;

test('requests without a session cookie are rejected', async () => {
  await assert.rejects(requireUser(request()), rejectsWith(401));
  await assert.rejects(requireUser(request('other=1')), rejectsWith(401));
});
test('forged or expired session tokens are rejected before any database lookup', async () => {
  const forged = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('u1').setExpirationTime('1h')
    .sign(new TextEncoder().encode('y'.repeat(40)));
  await assert.rejects(requireUser(request(`pf_session=${forged}`)), rejectsWith(401));
  const expired = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('u1').setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  await assert.rejects(requireUser(request(`pf_session=${expired}`)), rejectsWith(401));
  await assert.rejects(requireUser(request('pf_session=not-a-jwt')), rejectsWith(401));
});
test('a missing or short SESSION_SECRET is a configuration error, not an auth bypass', async () => {
  const saved = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'short';
  await assert.rejects(requireUser(request('pf_session=abc')), rejectsWith(503));
  process.env.SESSION_SECRET = saved;
});
