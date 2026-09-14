/* A portrait is a person's picture, not a community's photograph: it shows
   beside the name and nowhere else. The year page, the teaser and the
   name search all leave portraits out. */
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
        and ph.status = 'approved' and ph.public_path is not null and ph.portrait_of is null
    ), '[]'::jsonb)
  );
$$;

create or replace function tmz_teaser(n integer default 8, want tmz_lang_code default 'en')
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
    select ph.id, ph.public_path as path, ph.year,
           c.slug as community, tmz_community_name(c.id, want) as community_name,
           (select name from tmz_event_type_tr et
             where et.event_type_id = ph.event_type_id
             order by (et.lang = want) desc, (et.lang = 'en') desc limit 1) as event_name,
           (select caption from tmz_photo_tr tr
             where tr.photo_id = ph.id
             order by (tr.lang = want) desc, (tr.lang = 'en') desc limit 1) as caption
    from tmz_photo ph join tmz_community c on c.id = ph.community_id
    where ph.status = 'approved' and ph.public_path is not null and ph.year is not null and ph.portrait_of is null
    order by random()
    limit greatest(1, least(n, 24))
  ) x;
$$;

create or replace function tmz_photo_people_search(q text, want tmz_lang_code default 'en', lim integer default 40)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
    select ph.id, ph.public_path as path, ph.year, c.slug as community,
           tmz_community_name(c.id, want) as community_name,
           coalesce(ph.people_tr ->> want::text, ph.people_text) as people,
           coalesce(ph.occasion_tr ->> want::text, ph.occasion_text) as occasion
    from tmz_photo ph join tmz_community c on c.id = ph.community_id
    where length(trim(q)) >= 2 and ph.status = 'approved' and ph.public_path is not null and ph.portrait_of is null
      and (ph.people_text ilike '%' || trim(q) || '%'
           or exists (select 1 from jsonb_each_text(ph.people_tr) e where e.value ilike '%' || trim(q) || '%'))
    order by ph.year, ph.created_at
    limit greatest(1, least(lim, 100))
  ) x;
$$;

/* The map's per-year counts and the guide's facts count album photographs only. */
create or replace function tmz_map_payload(want tmz_lang_code default 'en')
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'lang', want,
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', tmz_region_name(r.id, want)) order by r.sort)
      from tmz_region r), '[]'::jsonb),
    'communities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',    c.slug,
        'name',  tmz_community_name(c.id, want),
        'lon',   c.lon,
        'lat',   c.lat,
        'rg',    c.region_id,
        'f',     c.founded_year,
        'c',     coalesce(c.closed_year, 0),
        'total', coalesce(p.total, 0),
        'years', coalesce(p.years, '{}'::jsonb)
      ) order by c.founded_year, c.slug)
      from tmz_community c
      left join lateral (
        select sum(x.n)::int as total,
               jsonb_object_agg(x.year::text, x.n) as years
        from (select year, count(*)::int as n
              from tmz_photo
              where community_id = c.id and status = 'approved'
                and public_path is not null and year is not null and portrait_of is null
              group by year) x
      ) p on true
    ), '[]'::jsonb)
  );
$$;
