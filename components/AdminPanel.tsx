import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Check, Loader2, RefreshCw, Search, Users } from 'lucide-react';
import type { AdminUser } from '../lib/types';
import { getAdminData, setDefaultLimit, updateAdminUser } from '../services/client';

export const formatTokens = (n: number) => n.toLocaleString('en');

export function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const ratio = limit === null ? 0 : limit === 0 ? 1 : Math.min(1, used / limit);
  const tone = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok';
  return <div className="usage-bar" role="meter" aria-valuemin={0} aria-valuemax={limit ?? undefined} aria-valuenow={used}>
    <span className={`usage-fill usage-${tone}`} style={{ width: `${ratio * 100}%` }}/>
  </div>;
}

function parseLimit(value: string): number | null | 'invalid' {
  const trimmed = value.replace(/[,\s_]/g, '');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000_000 ? n : 'invalid';
}

function UserRow({ user, defaultLimit, isSelf, onChanged, onError }: {
  user: AdminUser; defaultLimit: number; isSelf: boolean; onChanged: () => Promise<void>; onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(user.monthly_token_limit === null ? '' : String(user.monthly_token_limit));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(user.monthly_token_limit === null ? '' : String(user.monthly_token_limit)); }, [user.monthly_token_limit]);
  const effectiveLimit = user.isAdmin ? null : user.monthly_token_limit ?? defaultLimit;
  const parsed = parseLimit(draft);
  const dirty = parsed !== 'invalid' && parsed !== user.monthly_token_limit;

  async function apply(patch: Parameters<typeof updateAdminUser>[1]) {
    setSaving(true);
    try { await updateAdminUser(user.id, patch); await onChanged(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Update failed.'); }
    finally { setSaving(false); }
  }

  return <tr className={user.status === 'blocked' ? 'blocked-row' : ''}>
    <td><div className="admin-user">
      {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer"/> : <span className="avatar-fallback">{(user.name || user.email)[0]?.toUpperCase()}</span>}
      <div><strong>{user.name || user.email}</strong><span>{user.email}</span></div>
      {user.isAdmin && <span className="tag">ADMIN</span>}
    </div></td>
    <td><span className={`support ${user.status === 'blocked' ? 'support-unverified' : 'support-quote-matched'}`}>{user.status}</span></td>
    <td className="usage-cell">
      <div className="usage-numbers"><strong>{formatTokens(user.month_tokens)}</strong><span>/ {effectiveLimit === null ? 'unlimited' : formatTokens(effectiveLimit)}</span></div>
      <UsageBar used={user.month_tokens} limit={effectiveLimit}/>
      <span className="muted small">{user.month_runs} runs · {formatTokens(user.lifetime_tokens)} lifetime</span>
    </td>
    <td>{user.isAdmin ? <span className="muted small">Admins are not limited</span> : <form className="limit-form" onSubmit={e => { e.preventDefault(); if (dirty) void apply({ monthly_token_limit: parsed }); }}>
      <input aria-label={`Monthly token limit for ${user.email}`} inputMode="numeric" placeholder={`Default (${formatTokens(defaultLimit)})`} value={draft} onChange={e => setDraft(e.target.value)} disabled={saving}/>
      <button className="button secondary" type="submit" disabled={!dirty || saving} title="Save limit"><Check size={14}/></button>
      {parsed === 'invalid' && <span className="nonmatch small">Whole number, or empty for default</span>}
    </form>}</td>
    <td className="muted small">{new Date(user.last_seen_at).toLocaleDateString()}</td>
    <td>{!isSelf && <button className={user.status === 'blocked' ? 'button secondary' : 'button danger-outline'} disabled={saving}
      onClick={() => void apply({ status: user.status === 'blocked' ? 'active' : 'blocked' })}>
      {user.status === 'blocked' ? <><Check size={14}/> Unblock</> : <><Ban size={14}/> Block</>}
    </button>}</td>
  </tr>;
}

export function AdminPanel({ currentUserId }: { currentUserId: string }) {
  const [data, setData] = useState<{ defaultMonthlyTokenLimit: number; users: AdminUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [defaultDraft, setDefaultDraft] = useState('');
  const [savingDefault, setSavingDefault] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getAdminData();
      setData(next); setDefaultDraft(String(next.defaultMonthlyTokenLimit)); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load users.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const users = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (data?.users ?? []).filter(u => !q || u.email.includes(q) || (u.name ?? '').toLowerCase().includes(q));
  }, [data, filter]);

  if (!data) return error ? <div className="banner warning" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>
    : <div className="pending-inline" role="status"><Loader2 className="spin" size={18}/> Loading users…</div>;

  const monthTotal = data.users.reduce((sum, u) => sum + u.month_tokens, 0);
  const blocked = data.users.filter(u => u.status === 'blocked').length;
  const parsedDefault = parseLimit(defaultDraft);

  async function saveDefault() {
    if (typeof parsedDefault !== 'number') return;
    setSavingDefault(true);
    try { await setDefaultLimit(parsedDefault); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save default.'); }
    finally { setSavingDefault(false); }
  }

  return <div className="admin-panel">
    <div className="admin-heading"><h2>Users and token use</h2>
      <p>Usage is counted per calendar month (UTC) and includes failed runs. A limit is checked before each run starts, so one run can finish slightly over it.</p></div>
    {error && <div className="banner warning" role="alert"><AlertTriangle size={16}/><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
    <div className="admin-stats">
      <div className="stat-card"><div className="stat"><strong>{data.users.length}</strong><span>Users</span></div></div>
      <div className="stat-card"><div className="stat"><strong>{formatTokens(monthTotal)}</strong><span>Tokens this month</span></div></div>
      <div className="stat-card"><div className="stat"><strong>{blocked}</strong><span>Blocked</span></div></div>
      <form className="stat-card default-limit" onSubmit={e => { e.preventDefault(); void saveDefault(); }}>
        <label htmlFor="default-limit">Default monthly limit</label>
        <div className="limit-form"><input id="default-limit" inputMode="numeric" value={defaultDraft} onChange={e => setDefaultDraft(e.target.value)} disabled={savingDefault}/>
          <button className="button primary" type="submit" disabled={typeof parsedDefault !== 'number' || parsedDefault === data.defaultMonthlyTokenLimit || savingDefault}>Save</button></div>
        <span className="muted small">Applies to everyone without their own limit. 0 stops all non-admin runs.</span>
      </form>
    </div>
    <div className="admin-toolbar">
      <label className="search"><Search size={14}/><input placeholder="Filter by name or email" value={filter} onChange={e => setFilter(e.target.value)}/></label>
      <button className="link-button" onClick={() => void load()}><RefreshCw size={14}/> Refresh</button>
    </div>
    {users.length ? <div className="table-scroll"><table className="admin-table">
      <thead><tr><th>User</th><th>Status</th><th>This month</th><th>Monthly limit</th><th>Last seen</th><th/></tr></thead>
      <tbody>{users.map(u => <UserRow key={u.id} user={u} defaultLimit={data.defaultMonthlyTokenLimit} isSelf={u.id === currentUserId} onChanged={load} onError={setError}/>)}</tbody>
    </table></div> : <div className="panel-empty"><Users size={22}/><p>No users match that filter.</p></div>}
  </div>;
}
