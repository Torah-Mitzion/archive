/* The watchdog runs itself.
 *
 * Every two minutes, pg_cron asks the function to sweep: re-screen anything
 * stuck, apologise to anyone we received and did not answer, and ask the
 * provider whether it holds an inbound message we never got. The URL carries
 * the sweep secret, so it lives in a service-role-only table rather than in
 * this file. */

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists tmz_settings (
  key   text primary key,
  value text not null
);
alter table tmz_settings enable row level security;
revoke all on table tmz_settings from anon, authenticated;

comment on table tmz_settings is
  'Operational values that must not be committed — the sweep URL with its secret. Service role only.';

/* Idempotent: unschedule a previous copy before scheduling. */
do $$
begin
  perform cron.unschedule('tmz-sweep');
exception when others then null;
end $$;

select cron.schedule(
  'tmz-sweep',
  '*/2 * * * *',
  $$
    select net.http_post(
      url := (select value from public.tmz_settings where key = 'sweep_url'),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
    where exists (select 1 from public.tmz_settings where key = 'sweep_url');
  $$
);
