/* The guide could not see a hundred of the people in the register.
 *
 * Two things had gone wrong at once, both of them from changes made after the
 * facts query was written.
 *
 * The role list was a literal: rosh_kollel, shaliach, shlicha, staff. Six
 * roles have been added since, for the two communities that are not kollelim —
 * a director general, an office manager, shlichut, finance, a bat sherut, a
 * shlichim family — and the 49 people holding them were filtered out, which is
 * every one of the office's directors and every one of the families in India.
 * Asked who runs Torah MiTzion, the guide had nothing. It is now an exclusion
 * instead of a list: everyone who held a posting, minus the spouses and the
 * children, who are in the register and are nobody's business in a chat. A
 * role invented next year is in the facts the day it is used.
 *
 * And a tenure may now have no start year at all. The line was built by
 * concatenation, so a null year made the WHOLE line null — the person did not
 * come through as a line with a gap in it, they came through as a JSON null,
 * and 51 real people turned into 51 nulls in the prompt. An empty first field
 * says what is true: they served, and nobody wrote down when.
 *
 * org_kind travels with the community for the same reason: the guide must not
 * call the Jerusalem office a kollel, or ask the family in India who their
 * Rosh Kollel was. The rosh_kollel field itself stays what its name says —
 * Roshei Kollel, who carry the title the prompt tells the guide to use. The
 * office's directors and the families in India are in people, under their own
 * roles, with no title nobody claimed attached to them.
 *
 * Measured after the change: the facts are 170KB, about 2.5KB more than
 * before. Only 49 lines were being filtered out by the old role list — most of
 * the India roster is shaliach and shlicha, and Jerusalem's staff were already
 * through — but those 49 are the whole of the office's leadership and the
 * families in India, which is the half of the question the guide was asked.
 */
create or replace function tmz_chat_facts()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'communities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', c.slug,
        'names', (select jsonb_object_agg(lang, name) from tmz_community_tr where community_id = c.id),
        'region', c.region_id,
        'kind', c.org_kind,
        'founded', c.founded_year,
        'closed', c.closed_year,
        /* Roshei Kollel only, and the title goes with the role. Widening this
           to tmz_lead_role() would put the office's director general in a
           field the prompt tells the guide to address as Rabbi, and it did:
           asked who runs Torah MiTzion, it answered "הרב זאב שוורץ" for a man
           who does not claim it. The office's directors and the families in
           India are in people, under the roles they actually hold. */
        'rosh_kollel', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', tmz_rabbi_prefix('en') || tmz_person_name(t.person_id, 'en'),
            'name_he', tmz_rabbi_prefix('he') || tmz_person_name(t.person_id, 'he'),
            'from', t.start_year, 'to', t.end_year) order by t.start_year nulls last)
          from tmz_tenure t where t.community_id = c.id
            and t.role = 'rosh_kollel'), '[]'::jsonb),
        'people', coalesce((
          select jsonb_agg(r.line order by r.start_year nulls last, r.line)
          from (
            select t.start_year,
                   n.en
                   || case when n.he is not null and n.he is distinct from n.en then ' · ' || n.he else '' end
                   || '|' || t.role::text
                   || '|' || coalesce(t.start_year::text, '')
                   || '|' || coalesce(t.end_year::text, '') as line
            from tmz_tenure t
            cross join lateral (select tmz_person_name(t.person_id, 'en') as en,
                                       tmz_person_name(t.person_id, 'he') as he) n
            where t.community_id = c.id
              and t.role not in ('spouse', 'child')
              and n.en is not null
          ) r), '[]'::jsonb),
        'shlichim_by_year', coalesce((
          select jsonb_object_agg(y.yr, y.n) from (
            select g.yr, count(*) as n
            from generate_series(c.founded_year, coalesce(c.closed_year, 2026)) g(yr)
            join tmz_tenure t on t.community_id = c.id
              and t.role not in ('spouse', 'child')
              and g.yr between t.start_year and coalesce(t.end_year, 2200)
            group by g.yr) y), '{}'::jsonb),
        'people_no_year', (select count(*) from tmz_tenure t
          where t.community_id = c.id and t.start_year is null
            and t.role not in ('spouse', 'child')),
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
