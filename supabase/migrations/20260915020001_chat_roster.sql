/* The guide learns the register, not just the counts.
 *
 * It could already say how MANY shlichim a community had in a year, which is
 * exactly the wrong half: asked when Yoel Provizor was a shaliach, or who was
 * in Atlanta in 2013, it had nothing to answer with, although both are printed
 * on the site's own shlichim page. So every tenure goes into the facts, one
 * line each:
 *
 *   "Yoel Provizor · יואל פרוביזור|shaliach|2013|2014"
 *
 * A line rather than an object because there are some 1,700 of them and the
 * whole thing travels in every prompt; the Hebrew half is dropped when the
 * register holds only one spelling, and an empty last field means the end year
 * was never recorded. Measured on the full register: the facts grow from about
 * 25KB to about 90KB, and the query from 0.6s to 1.2s — it is asked for once
 * per isolate per five minutes.
 *
 * Only the roles that served — Rosh Kollel, shaliach, shlicha, staff — the
 * same set shlichim_by_year counts. Spouses and children are in the register
 * and on nobody's business in a chat context.
 */
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
        'people', coalesce((
          select jsonb_agg(r.line order by r.start_year, r.line)
          from (
            select t.start_year,
                   n.en
                   || case when n.he is not null and n.he is distinct from n.en then ' · ' || n.he else '' end
                   || '|' || t.role::text
                   || '|' || t.start_year::text
                   || '|' || coalesce(t.end_year::text, '') as line
            from tmz_tenure t
            cross join lateral (select tmz_person_name(t.person_id, 'en') as en,
                                       tmz_person_name(t.person_id, 'he') as he) n
            where t.community_id = c.id
              and t.role in ('rosh_kollel', 'shaliach', 'shlicha', 'staff')
              and n.en is not null
          ) r), '[]'::jsonb),
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
