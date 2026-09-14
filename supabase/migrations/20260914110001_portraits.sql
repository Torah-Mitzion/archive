/* Portraits. A shaliach can send a picture of themselves over WhatsApp and
   say so; it becomes their picture on every year page they appear on. The
   photograph goes through the same screening as any other, and is linked to
   the person by name against the register — the link is recorded on the
   photograph, the published copy on the person. */

alter table tmz_person add column if not exists portrait_path text;
comment on column tmz_person.portrait_path is 'Path in tmz-photo-public of the person''s own picture, once one has been sent and screened.';

alter table tmz_photo add column if not exists portrait_of uuid references tmz_person(id) on delete set null;
alter table tmz_photo add column if not exists portrait_name text;
comment on column tmz_photo.portrait_of is 'The person this photograph is a portrait of, once the name resolved to one register entry.';
comment on column tmz_photo.portrait_name is 'The name the sender gave for a portrait that has not resolved yet (several matches, or none).';

/* The year page draws the portrait where it has one. */
create or replace function tmz_year_payload(community_slug text, yr integer,
                                            want tmz_lang_code default 'en')
returns jsonb language sql stable as $$
  with c as (select * from tmz_community where slug = community_slug)
  select jsonb_build_object(
    'community', (select jsonb_build_object(
        'id', c.slug, 'name', tmz_community_name(c.id, want),
        'region', tmz_region_name(c.region_id, want),
        'f', c.founded_year, 'c', coalesce(c.closed_year, 0)) from c),
    'year', yr,
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           t.id,
        'person',       tmz_person_name(t.person_id, want),
        'portrait',     (select portrait_path from tmz_person where id = t.person_id),
        'role',         t.role,
        'from',         t.start_year,
        'to',           t.end_year,
        'institution',  (select name from tmz_institution_tr it
                         where it.institution_id = t.institution_id
                         order by (it.lang = want) desc, (it.lang = 'en') desc limit 1),
        'household_of', t.household_of)
        order by t.role, t.start_year)
      from tmz_tenure t, c
      where t.community_id = c.id
        and yr between t.start_year and coalesce(t.end_year, 2200)
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id, 'path', ph.public_path, 'taken_on', ph.taken_on,
        'venue', ph.venue, 'event', ph.event_type_id,
        'event_name', (select name from tmz_event_type_tr et
                       where et.event_type_id = ph.event_type_id
                       order by (et.lang = want) desc, (et.lang = 'en') desc limit 1),
        'people', (select count(*) from tmz_photo_person pp where pp.photo_id = ph.id))
        order by ph.taken_on nulls last)
      from tmz_photo ph, c
      where ph.community_id = c.id and ph.year = yr
        and ph.status = 'approved' and ph.public_path is not null
    ), '[]'::jsonb)
  );
$$;

/* Search by name, optionally within one community — a common surname needs
   the place to narrow it — and carry the portrait. One signature only:
   PostgREST cannot choose between two that differ only in defaults. */
drop function if exists tmz_person_search(text, tmz_lang_code, integer);
create or replace function tmz_person_search(q text, want tmz_lang_code default 'en', lim integer default 40,
                                             community_slug text default null)
returns jsonb language sql stable as $$
  with hit as (
    select distinct tr.person_id
    from tmz_person_tr tr
    where length(trim(q)) >= 2 and tr.display_name ilike '%' || trim(q) || '%'
      and (community_slug is null or exists (
        select 1 from tmz_tenure t join tmz_community c on c.id = t.community_id
        where t.person_id = tr.person_id and c.slug = community_slug))
    limit greatest(1, least(lim, 200))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',       p.id,
    'name',     tmz_person_name(p.id, want),
    'portrait', p.portrait_path,
    'tenures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'community', c.slug,
        'community_name', tmz_community_name(c.id, want),
        'role', t.role, 'from', t.start_year, 'to', t.end_year)
        order by t.start_year)
      from tmz_tenure t join tmz_community c on c.id = t.community_id
      where t.person_id = p.id), '[]'::jsonb)
  ) order by tmz_person_name(p.id, want)), '[]'::jsonb)
  from tmz_person p join hit on hit.person_id = p.id;
$$;
grant execute on function tmz_person_search(text, tmz_lang_code, integer, text) to anon, authenticated;
