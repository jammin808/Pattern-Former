import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';
import type { GoogleProfile } from './auth.js';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  status: 'active' | 'blocked';
  monthly_token_limit: number | null;
  created_at: string;
  last_seen_at: string;
}
export interface AdminUserRow extends AppUser { month_tokens: number; month_runs: number; lifetime_tokens: number }
export interface UsageRecord {
  userId: string; mode: string; provider: string; model: string;
  inputTokens: number; outputTokens: number; succeeded: boolean;
}

let client: SupabaseClient | undefined;

// The service-role key bypasses row-level security, so it must only ever exist on the server.
function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new HttpError(503, 'Server is not configured with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Database error: ${result.error.message}`);
  return result.data;
}

// Creates the user on first sign-in; later sign-ins refresh profile fields but keep status and limit.
export async function upsertUser(profile: GoogleProfile): Promise<AppUser> {
  return check(await db().from('app_users').upsert({
    google_sub: profile.sub, email: profile.email, name: profile.name ?? null,
    picture: profile.picture ?? null, last_seen_at: new Date().toISOString(),
  }, { onConflict: 'google_sub' }).select().single()) as AppUser;
}

export async function getUser(id: string): Promise<AppUser | null> {
  return check(await db().from('app_users').select().eq('id', id).maybeSingle()) as AppUser | null;
}

export async function monthUsage(userId: string): Promise<number> {
  return Number(check(await db().rpc('pf_month_usage', { p_user: userId })));
}

export async function defaultMonthlyLimit(): Promise<number> {
  const row = check(await db().from('app_settings').select('value').eq('key', 'default_monthly_token_limit').maybeSingle());
  return Number(row?.value ?? 0);
}

export async function setDefaultMonthlyLimit(limit: number): Promise<void> {
  check(await db().from('app_settings').upsert({ key: 'default_monthly_token_limit', value: limit }));
}

export async function recordUsage(usage: UsageRecord): Promise<void> {
  check(await db().from('usage_events').insert({
    user_id: usage.userId, mode: usage.mode, provider: usage.provider, model: usage.model,
    input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, succeeded: usage.succeeded,
  }));
}

export async function listUsersWithUsage(): Promise<AdminUserRow[]> {
  return (check(await db().rpc('pf_admin_users')) as AdminUserRow[]).map(row => ({
    ...row, month_tokens: Number(row.month_tokens), month_runs: Number(row.month_runs), lifetime_tokens: Number(row.lifetime_tokens),
  }));
}

export async function updateUser(id: string, patch: Partial<Pick<AppUser, 'status' | 'monthly_token_limit'>>): Promise<AppUser> {
  const user = check(await db().from('app_users').update(patch).eq('id', id).select().maybeSingle()) as AppUser | null;
  if (!user) throw new HttpError(404, 'User not found.');
  return user;
}
