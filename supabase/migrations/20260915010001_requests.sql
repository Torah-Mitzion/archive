/* Requests from the people who send photographs: take mine down, fix the
   spelling of a name, I am in this picture, something is wrong. The
   WhatsApp agent opens them when it cannot act alone (or must not — a
   takedown is a human's decision); the back office works through them.
   When staff resolve one, the agent tells the sender. */

create type tmz_request_kind as enum ('takedown', 'fix_name', 'fix_details', 'tag_me', 'question', 'other');
create type tmz_request_status as enum ('open', 'in_progress', 'done', 'declined');

create table tmz_request (
  id            uuid primary key default gen_random_uuid(),
  kind          tmz_request_kind not null default 'other',
  status        tmz_request_status not null default 'open',
  submitter_ref text not null,                      -- wa:<number>; who to answer
  lang          text not null default 'en',
  photo_id      uuid references tmz_photo(id) on delete set null,
  person_id     uuid references tmz_person(id) on delete set null,
  summary       text not null,                      -- what they asked, in one line (model-written, in English)
  quote         text,                               -- their own words
  proposed      jsonb not null default '{}'::jsonb, -- e.g. {"field":"people_text","from":"Kohn","to":"Cohen"}
  staff_note    text,
  reply_sent_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index tmz_request_status_idx on tmz_request (status, created_at desc);
create index tmz_request_ref_idx on tmz_request (submitter_ref, created_at desc);

alter table tmz_request enable row level security;
revoke all on tmz_request from anon;
grant select, update on tmz_request to authenticated;
create policy tmz_request_staff on tmz_request
  for all to authenticated using (tmz_is_staff()) with check (tmz_is_staff());

create or replace function tmz_request_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status in ('done', 'declined') and old.status not in ('done', 'declined') then new.resolved_at := now(); end if;
  return new;
end $$;
create trigger tmz_request_touch before update on tmz_request for each row execute function tmz_request_touch();

/* The back office's list, with the photograph and person it is about. */
create or replace view tmz_request_board with (security_invoker = true) as
  select r.*,
         ph.public_path, ph.community_id, ph.year, ph.people_text, ph.status as photo_status,
         c.slug as community_slug,
         (select display_name from tmz_person_tr where person_id = r.person_id and lang = 'en' limit 1) as person_name
  from tmz_request r
  left join tmz_photo ph on ph.id = r.photo_id
  left join tmz_community c on c.id = ph.community_id;
grant select on tmz_request_board to authenticated;
