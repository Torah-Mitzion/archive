/* Two communities that are not kollelim.
 *
 * The register was built around one shape: a Rosh Kollel, his household, and
 * the shlichim who served with him. Two entries do not have that shape and
 * never will. Jerusalem is the office — a director general, the people who run
 * it, and a bat sherut. Lev Yehodi in India is a family of shlichim with no
 * kollel at all.
 *
 * Forcing either into the kollel's vocabulary would have meant calling a
 * director general a Rosh Kollel on every page he appears on, which is not a
 * rounding error — it is the wrong word for a real person's job. So the
 * community says what kind of thing it is, and the pages read the roles that
 * belong to that kind.
 *
 * Everything else keeps the shape it has: org_kind defaults to 'kollel', and a
 * community nobody has said anything about behaves exactly as before.
 */

-- Part one: the values. Postgres will not let a new enum label be USED in the
-- transaction that adds it, so nothing below this line may reference them.
alter type tmz_tenure_role add value if not exists 'ceo';
alter type tmz_tenure_role add value if not exists 'office_manager';
alter type tmz_tenure_role add value if not exists 'shlichut';
alter type tmz_tenure_role add value if not exists 'finance';
alter type tmz_tenure_role add value if not exists 'bat_sherut';
alter type tmz_tenure_role add value if not exists 'shaliach_family';

-- Part two: everything that USES those values. Applied as a separate statement
-- batch for the reason given above.

/* What kind of thing a community is. 'kollel' is the shape the whole register
   was built around and stays the default, so a community nobody has said
   anything about behaves exactly as it did. */
alter table tmz_community add column if not exists org_kind text not null default 'kollel';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tmz_community_org_kind_ck') then
    alter table tmz_community add constraint tmz_community_org_kind_ck
      check (org_kind in ('kollel', 'office', 'family'));
  end if;
end $$;

comment on column tmz_community.org_kind is
  'kollel: a Rosh Kollel, his household and the shlichim with him. office: the organisation''s own staff. family: one family of shlichim, no kollel.';

/* Who leads a place of this kind. One function so the answer is the same in
   the year page, the community page and the chat guide — three places that
   each used to spell ''rosh_kollel'' for themselves. */
create or replace function tmz_lead_role(kind text) returns tmz_tenure_role
language sql immutable as $$
  select case kind
    when 'office' then 'ceo'::tmz_tenure_role
    when 'family' then 'shaliach_family'::tmz_tenure_role
    else 'rosh_kollel'::tmz_tenure_role
  end;
$$;

update tmz_community set org_kind = 'office' where slug = 'jerusalem';
update tmz_community set org_kind = 'family' where slug = 'Lev Yehodi - India';

/* The community page's band of leaders, whatever a leader is called here. The
   rabbi prefix stays with the Rosh Kollel: a director general is not a rabbi
   by virtue of the job, and writing one in front of his name would be putting
   a title on a real person that he never claimed. */
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
        'from', t.start_year, 'to', t.end_year) order by t.start_year)
      from tmz_tenure t, c
      where t.community_id = c.id and t.role = tmz_lead_role(c.org_kind)), '[]'::jsonb),
    'people', (select count(distinct t.person_id) from tmz_tenure t, c where t.community_id = c.id),
    'years_with_people', (select count(distinct y) from tmz_tenure t, c,
        lateral generate_series(t.start_year, coalesce(t.end_year, t.start_year)) y where t.community_id = c.id)
  );
$function$;

/* The year page needs to know the kind so it can group the roster and name the
   groups; everything else about this payload is unchanged. */
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
$function$;
