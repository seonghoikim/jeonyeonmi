-- Curator hardening. Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.
--
-- 1) curator_logs holds visitors' free-text questions, so it must not be readable with the
--    public anon key. The Edge Function (service role) still writes to it, and the weekly
--    report reads it through GET /curator/report (X-Report-Key), not the REST API.
-- 2) curator_usage + curator_hit() back the rate limits (per-visitor and per-day) so they
--    hold across serverless instances instead of resetting in memory.

-- 1) lock down curator_logs -------------------------------------------------------------
alter table public.curator_logs enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'curator_logs' loop
    execute format('drop policy %I on public.curator_logs', p.policyname);
  end loop;
end $$;

revoke all on public.curator_logs from anon, authenticated;

-- 2) rate-limit counters ----------------------------------------------------------------
create table if not exists public.curator_usage (
  bucket     text primary key,
  count      integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.curator_usage enable row level security;
revoke all on public.curator_usage from anon, authenticated;

create or replace function public.curator_hit(p_bucket text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.curator_usage (bucket, count) values (p_bucket, 1)
  on conflict (bucket) do update set count = public.curator_usage.count + 1, updated_at = now()
  returning count;
$$;

revoke all on function public.curator_hit(text) from public, anon, authenticated;
grant execute on function public.curator_hit(text) to service_role;
