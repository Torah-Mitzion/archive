/* Two read-only views of the archive for the public site's two new fronts:
   a teaser of random photographs on the landing page, and the facts the
   site's chat assistant is allowed to know. Both read only what is already
   public — approved photographs with a public copy, and the roster that the
   year pages print. */

/* A handful of published photographs, in random order, with enough to draw
   a thumbnail and to know which page it belongs to. A photograph that is
   approved but not yet placed in a community and a year has no page to
   send anyone to, so it is not a teaser. */
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
    where ph.status = 'approved' and ph.public_path is not null and ph.year is not null
    order by random()
    limit greatest(1, least(n, 24))
  ) x;
$$;
grant execute on function tmz_teaser(integer, tmz_lang_code) to anon, authenticated;

/* Everything the chat assistant may say, in one document: each community
   with its span, and for each year the Rosh Kollel, how many shlichim and
   how many photographs. Names in every language we hold, so the assistant
   can answer in the language it was asked in. Read by the tmz-chat function
   with the service role; not offered to the browser, which has no use for
   the whole archive at once. */
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
            'name', tmz_person_name(t.person_id, 'en'),
            'name_he', tmz_person_name(t.person_id, 'he'),
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
            group by ph.year) p), '{}'::jsonb)
      ) order by c.slug)
      from tmz_community c), '[]'::jsonb),
    'generated_at', now()
  );
$$;
revoke all on function tmz_chat_facts() from public, anon, authenticated;
