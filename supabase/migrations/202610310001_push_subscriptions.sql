create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'taskpulse-push-reminders',
  '*/1 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/push-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
