-- Applied to the pattern-former Supabase project. Kept here as the schema of record.

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  name text,
  picture text,
  status text not null default 'active' check (status in ('active', 'blocked')),
  -- null means the default monthly limit from app_settings applies
  monthly_token_limit bigint check (monthly_token_limit >= 0),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  mode text not null,
  provider text not null,
  model text not null,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  total_tokens bigint generated always as (input_tokens + output_tokens) stored,
  succeeded boolean not null
);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('default_monthly_token_limit', '200000');

-- Only the server (service role) may touch these tables.
alter table public.app_users enable row level security;
alter table public.usage_events enable row level security;
alter table public.app_settings enable row level security;
revoke all on public.app_users, public.usage_events, public.app_settings from anon, authenticated;

-- Tokens used by one user in the current calendar month (UTC).
create function public.pf_month_usage(p_user uuid)
returns bigint
language sql stable
set search_path = ''
as $$
  select coalesce(sum(total_tokens), 0)::bigint
  from public.usage_events
  where user_id = p_user
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

-- Admin listing: every user with this month's usage.
create function public.pf_admin_users()
returns table (
  id uuid, email text, name text, picture text, status text,
  monthly_token_limit bigint, created_at timestamptz, last_seen_at timestamptz,
  month_tokens bigint, month_runs bigint, lifetime_tokens bigint
)
language sql stable
set search_path = ''
as $$
  select u.id, u.email, u.name, u.picture, u.status, u.monthly_token_limit, u.created_at, u.last_seen_at,
    coalesce(sum(e.total_tokens) filter (where e.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'), 0)::bigint,
    count(e.id) filter (where e.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'),
    coalesce(sum(e.total_tokens), 0)::bigint
  from public.app_users u
  left join public.usage_events e on e.user_id = u.id
  group by u.id
  order by u.last_seen_at desc;
$$;

revoke execute on function public.pf_month_usage(uuid), public.pf_admin_users() from public, anon, authenticated;
grant execute on function public.pf_month_usage(uuid), public.pf_admin_users() to service_role;
