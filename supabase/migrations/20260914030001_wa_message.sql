/* The conversation itself.
 *
 * The agent answered every message as if it were the first: "why?" after a
 * refusal got the same nudge as a stranger's hello. It had no memory, because
 * nothing was stored — each message was parsed for a community and a year and
 * then forgotten.
 *
 * This is the memory. Every message in and out, per sender, with what it was
 * about: which photograph, which question, which refusal and why. The reply is
 * written with the last thirty of these in front of it, so "why?" means the
 * thing it means. */

create table tmz_wa_message (
  id          bigint generated always as identity primary key,
  ref         text not null,                          -- 'wa:<phone>'
  direction   text not null check (direction in ('in', 'out')),
  kind        text not null check (kind in ('text', 'photo', 'question', 'refusal', 'welcome', 'other')),
  text        text,                                   -- what was said; for a photo, its caption
  photo_id    uuid references tmz_photo(id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,     -- the refusal's reason, the question's field
  created_at  timestamptz not null default now()
);

create index tmz_wa_message_ref_idx on tmz_wa_message (ref, created_at desc);

comment on table tmz_wa_message is
  'The WhatsApp conversation, both directions. The agent reads the last 30 rows for a sender before it answers. Service role only.';

alter table tmz_wa_message enable row level security;
revoke all on table tmz_wa_message from anon, authenticated;

/* Test-console cleanup takes the conversation with it. */
create or replace function tmz_sim_reset(p_ref text)
returns table (photos integer, submissions integer)
language plpgsql security definer set search_path = public as $$
declare
  ph integer;
  sb integer;
begin
  with doomed as (
    select p.id from tmz_photo p
    join tmz_submission s on s.id = p.submission_id
    where s.is_test and p.submitter_ref like p_ref || '%'
  ), del as (
    delete from tmz_photo where id in (select id from doomed) returning 1
  ) select count(*)::integer into ph from del;

  with del as (
    delete from tmz_submission
    where is_test and ip_hash like p_ref || '%'
      and not exists (select 1 from tmz_photo p where p.submission_id = tmz_submission.id)
    returning 1
  ) select count(*)::integer into sb from del;

  delete from tmz_wa_message where ref = p_ref
    and exists (select 1 from tmz_wa_contact c where c.ref = p_ref and c.is_test);
  delete from tmz_wa_contact where is_test and ref = p_ref;

  return query select ph, sb;
end;
$$;

revoke all on function tmz_sim_reset(text) from public, anon, authenticated;
