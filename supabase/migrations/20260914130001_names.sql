/* Names, in the language the reader reads.

   1. The names people give for a photograph are shown under it and kept in
      every script we can produce, so the guide and the search find "Cohen"
      and "כהן" alike. people_tr / occasion_tr hold {lang: text}, written by
      the agents the moment the answer lands.
   2. Whoever served as Rosh Kollel carries the title in front of the name:
      Rabbi / הרב / Рав / Rav. Decided from the tenures, applied where names
      are read out, never written into the name itself. */

alter table tmz_photo add column if not exists people_tr jsonb not null default '{}'::jsonb;
alter table tmz_photo add column if not exists occasion_tr jsonb not null default '{}'::jsonb;
comment on column tmz_photo.people_tr is 'people_text rendered per language, {lang: text}; transliterations of names.';
comment on column tmz_photo.occasion_tr is 'occasion_text rendered per language, {lang: text}.';

create or replace function tmz_rabbi_prefix(want tmz_lang_code)
returns text language sql immutable as $$
  select case want when 'he' then 'הרב ' when 'ru' then 'Рав ' when 'en' then 'Rabbi ' else 'Rav ' end;
$$;

create or replace function tmz_person_display(pid uuid, want tmz_lang_code)
returns text language sql stable as $$
  select case when exists (select 1 from tmz_tenure t where t.person_id = pid and t.role = 'rosh_kollel')
              then tmz_rabbi_prefix(want) else '' end || coalesce(tmz_person_name(pid, want), '');
$$;

/* The name and the occasion in the reader's language, with the original as
   the fallback, plus the untranslated original so a caption can show both. */
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
        'person',       case when t.role = 'rosh_kollel' then tmz_rabbi_prefix(want) else '' end
                        || tmz_person_name(t.person_id, want),
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
        'people_text', coalesce(ph.people_tr ->> want::text, ph.people_text),
        'occasion_text', coalesce(ph.occasion_tr ->> want::text, ph.occasion_text),
        'people', (select count(*) from tmz_photo_person pp where pp.photo_id = ph.id))
        order by ph.taken_on nulls last, ph.created_at)
      from tmz_photo ph, c
      where ph.community_id = c.id and ph.year = yr
        and ph.status = 'approved' and ph.public_path is not null
    ), '[]'::jsonb)
  );
$$;

drop function if exists tmz_person_search(text, tmz_lang_code, integer, text);
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
    'name',     tmz_person_display(p.id, want),
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

/* Photographs whose given names match, in any script we hold. */
create or replace function tmz_photo_people_search(q text, want tmz_lang_code default 'en', lim integer default 40)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
    select ph.id, ph.public_path as path, ph.year, c.slug as community,
           tmz_community_name(c.id, want) as community_name,
           coalesce(ph.people_tr ->> want::text, ph.people_text) as people,
           coalesce(ph.occasion_tr ->> want::text, ph.occasion_text) as occasion
    from tmz_photo ph join tmz_community c on c.id = ph.community_id
    where length(trim(q)) >= 2 and ph.status = 'approved' and ph.public_path is not null
      and (ph.people_text ilike '%' || trim(q) || '%'
           or exists (select 1 from jsonb_each_text(ph.people_tr) e where e.value ilike '%' || trim(q) || '%'))
    order by ph.year, ph.created_at
    limit greatest(1, least(lim, 100))
  ) x;
$$;
grant execute on function tmz_photo_people_search(text, tmz_lang_code, integer) to anon, authenticated;

/* The guide learns who is in the photographs, and who was Rosh Kollel with
   the title. */
create or replace function tmz_chat_facts()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'communities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', c.slug,
        'names', (select jsonb_object_agg(lang, name) from tmz_community_tr where community_id = c.id),
        'region', c.region_id,
        'founded', c.founded_year,
        'closed', c.closed_year,
        'rosh_kollel', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', tmz_rabbi_prefix('en') || tmz_person_name(t.person_id, 'en'),
            'name_he', tmz_rabbi_prefix('he') || tmz_person_name(t.person_id, 'he'),
            'from', t.start_year, 'to', t.end_year) order by t.start_year)
          from tmz_tenure t where t.community_id = c.id and t.role = 'rosh_kollel'), '[]'::jsonb),
        'shlichim_by_year', coalesce((
          select jsonb_object_agg(y.yr, y.n) from (
            select g.yr, count(*) as n
            from generate_series(c.founded_year, coalesce(c.closed_year, 2026)) g(yr)
            join tmz_tenure t on t.community_id = c.id
              and t.role in ('rosh_kollel','shaliach','shlicha','staff')
              and g.yr between t.start_year and coalesce(t.end_year, 2200)
            group by g.yr) y), '{}'::jsonb),
        'photos_by_year', coalesce((
          select jsonb_object_agg(p.year, p.n) from (
            select ph.year, count(*) as n from tmz_photo ph
            where ph.community_id = c.id and ph.status = 'approved'
              and ph.public_path is not null and ph.year is not null
            group by ph.year) p), '{}'::jsonb),
        'photos_with_names', coalesce((
          select jsonb_agg(jsonb_build_object(
            'year', ph.year, 'people', ph.people_text, 'people_tr', ph.people_tr,
            'occasion', ph.occasion_text) order by ph.year)
          from tmz_photo ph
          where ph.community_id = c.id and ph.status = 'approved' and ph.public_path is not null
            and ph.people_text is not null), '[]'::jsonb)
      ) order by c.slug)
      from tmz_community c), '[]'::jsonb),
    'generated_at', now()
  );
$$;
revoke all on function tmz_chat_facts() from public, anon, authenticated;
