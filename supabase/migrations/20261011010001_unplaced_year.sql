/* People whose year nobody has written down yet.
 *
 * The two lists that came from the organisation carry 51 names with no year
 * at all: 13 of the 68 people in the Jerusalem office, and 38 of the 72 at Lev
 * Yehodi in India. Until now a tenure could not exist without a start year, so
 * the only choices were to leave those people out of the archive entirely or
 * to invent a date for them.
 *
 * Neither is acceptable for a register of real people. So a tenure may now say
 * "we do not know when", and the community page offers that as its own tile
 * beside the years: they are in the register, they are findable, and the page
 * says plainly that the year is missing rather than guessing one.
 *
 * A null start year never joins a real year: every query that places a tenure
 * in time does it with BETWEEN, which excludes null, so nobody lands in 1996
 * by accident.
 */
alter table tmz_tenure alter column start_year drop not null;

comment on column tmz_tenure.start_year is
  'The year this service began. Null means nobody has recorded it yet — the person belongs to the community but to no year of it.';

/* The year page, when asked for the people with no year. yr is null for that
   question, which is why the roster condition is written out rather than left
   to BETWEEN: null between anything is null, and the whole point here is to
   find the rows that have none. */
create or replace function tmz_year_payload(community_slug text, yr integer, want tmz_lang_code default 'en')
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with c as (select * from tmz_community where slug = community_slug)
  select jsonb_build_object(
    'community', (select jsonb_build_object(
        'id', c.slug, 'name', tmz_community_name(c.id, want),
        'region', tmz_region_name(c.region_id, want),
        'kind', c.org_kind,
        'f', c.founded_year, 'c', coalesce(c.closed_year, 0)) from c),
    'year', yr,
    /* So the year page can draw the chip without a second round trip: the rail
       has to offer the way in to the people with no year from every year, not
       only from the community's front page. */
    'unplaced', (select count(distinct t.person_id) from tmz_tenure t, c
                 where t.community_id = c.id and t.start_year is null),
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
        order by t.role, t.start_year nulls last, tmz_person_name(t.person_id, want))
      from tmz_tenure t, c
      where t.community_id = c.id
        and case when yr is null then t.start_year is null
                 else yr between t.start_year and coalesce(t.end_year, 2200) end
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
$function$;

/* The community page needs to know the tile is worth drawing. */
create or replace function tmz_community_overview(community_slug text, want tmz_lang_code default 'en')
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with c as (select * from tmz_community where slug = community_slug)
  select jsonb_build_object(
    'org_kind', (select org_kind from c),
    'roshei', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', case when t.role = 'rosh_kollel' then tmz_rabbi_prefix(want) else '' end
                || tmz_person_name(t.person_id, want),
        'role', t.role,
        'portrait', (select portrait_path from tmz_person where id = t.person_id),
        'from', t.start_year, 'to', t.end_year) order by t.start_year nulls last)
      from tmz_tenure t, c
      where t.community_id = c.id and t.role = tmz_lead_role(c.org_kind)), '[]'::jsonb),
    'people', (select count(distinct t.person_id) from tmz_tenure t, c where t.community_id = c.id),
    'unplaced', (select count(distinct t.person_id) from tmz_tenure t, c
                 where t.community_id = c.id and t.start_year is null),
    'years_with_people', (select count(distinct y) from tmz_tenure t, c,
        lateral generate_series(t.start_year, coalesce(t.end_year, t.start_year)) y where t.community_id = c.id)
  );
$function$;
