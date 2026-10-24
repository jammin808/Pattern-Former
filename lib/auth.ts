import type { ServerResponse } from 'node:http';
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError, type ApiRequest } from './http.js';
import { getUser, type AppUser } from './db.js';

const COOKIE = 'pf_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface GoogleProfile { sub: string; email: string; name?: string; picture?: string }

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, 'Server is not configured with SESSION_SECRET (32+ characters).');
  return new TextEncoder().encode(secret);
}

export function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new HttpError(503, 'Server is not configured with GOOGLE_CLIENT_ID.');
  return id;
}

// Verifies a Google Identity Services ID token: signature, issuer, audience, expiry and verified email.
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  let payload;
  try {
    ({ payload } = await jwtVerify(credential, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: googleClientId(),
    }));
  } catch {
    throw new HttpError(401, 'Google sign-in could not be verified.');
  }
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || payload.email_verified !== true) {
    throw new HttpError(401, 'Google account email is not verified.');
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

export function isAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function startSession(res: ServerResponse, userId: string): Promise<void> {
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(sessionKey());
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`);
}

export function endSession(res: ServerResponse): void {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function readCookie(req: ApiRequest, name: string): string | undefined {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

// Returns the signed-in user, or throws 401. Blocked users are returned so callers can say why.
export async function requireUser(req: ApiRequest): Promise<AppUser> {
  const token = readCookie(req, COOKIE);
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  let userId: string | undefined;
  try {
    ({ payload: { sub: userId } } = await jwtVerify(token, sessionKey(), { algorithms: ['HS256'] }));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }
  const user = userId ? await getUser(userId) : null;
  if (!user) throw new HttpError(401, 'Sign in to continue.');
  return user;
}

export async function requireAdmin(req: ApiRequest): Promise<AppUser> {
  const user = await requireUser(req);
  if (!isAdmin(user.email)) throw new HttpError(403, 'Admin access required.');
  return user;
}
