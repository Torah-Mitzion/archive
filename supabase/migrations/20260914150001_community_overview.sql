/* The community's own page: its Roshei Kollel across the years and how many
   people served there in all. The per-year photograph counts the timeline
   needs already travel with the map payload. */
create or replace function tmz_community_overview(community_slug text, want tmz_lang_code default 'en')
returns jsonb language sql stable as $$
  with c as (select * from tmz_community where slug = community_slug)
  select jsonb_build_object(
    'roshei', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', tmz_rabbi_prefix(want) || tmz_person_name(t.person_id, want),
        'portrait', (select portrait_path from tmz_person where id = t.person_id),
        'from', t.start_year, 'to', t.end_year) order by t.start_year)
      from tmz_tenure t, c where t.community_id = c.id and t.role = 'rosh_kollel'), '[]'::jsonb),
    'people', (select count(distinct t.person_id) from tmz_tenure t, c where t.community_id = c.id),
    'years_with_people', (select count(distinct y) from tmz_tenure t, c,
        lateral generate_series(t.start_year, coalesce(t.end_year, t.start_year)) y where t.community_id = c.id)
  );
$$;
grant execute on function tmz_community_overview(text, tmz_lang_code) to anon, authenticated;
