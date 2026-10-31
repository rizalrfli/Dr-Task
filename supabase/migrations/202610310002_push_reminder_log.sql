create table if not exists public.push_reminder_log (
  task_id text not null,
  endpoint text not null,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (task_id, endpoint)
);

alter table public.push_reminder_log add column if not exists claimed_at timestamptz not null default now();
alter table public.push_reminder_log add column if not exists sent_at timestamptz;
create unique index if not exists push_reminder_log_task_endpoint_idx on public.push_reminder_log(task_id, endpoint);

alter table public.push_reminder_log enable row level security;

create index if not exists push_reminder_log_claimed_at_idx on public.push_reminder_log (claimed_at);

create or replace function public.claim_push_reminder(p_task_id text, p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  did_claim boolean := false;
  slot_start timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
begin
  insert into public.push_reminder_log as existing (task_id, endpoint, claimed_at)
  values (p_task_id, p_endpoint, slot_start)
  on conflict (task_id, endpoint) do update
    set claimed_at = excluded.claimed_at, sent_at = null
    where existing.claimed_at < slot_start
  returning true into did_claim;
  return coalesce(did_claim, false);
end;
$$;

create or replace function public.finish_push_reminder(p_task_id text, p_endpoint text, p_sent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_sent then
    update public.push_reminder_log set sent_at = now()
    where task_id = p_task_id and endpoint = p_endpoint;
  else
    delete from public.push_reminder_log where task_id = p_task_id and endpoint = p_endpoint;
  end if;
end;
$$;

revoke all on function public.claim_push_reminder(text, text) from public, anon, authenticated;
revoke all on function public.finish_push_reminder(text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_push_reminder(text, text) to service_role;
grant execute on function public.finish_push_reminder(text, text, boolean) to service_role;
