/* Find a shaliach by name. The register holds 1,634 people; the way anyone
   will look for a face is by a name, and the way they will spell it is in
   whatever language they think in. Matches any translation we hold, returns
   the name in the requested language and every tenure with its community,
   so the page can send them straight to the right year. */
create or replace function tmz_person_search(q text, want tmz_lang_code default 'en', lim integer default 40)
returns jsonb language sql stable as $$
  with hit as (
    select distinct tr.person_id
    from tmz_person_tr tr
    where length(trim(q)) >= 2 and tr.display_name ilike '%' || trim(q) || '%'
    limit greatest(1, least(lim, 100))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',     p.id,
    'name',   tmz_person_name(p.id, want),
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
grant execute on function tmz_person_search(text, tmz_lang_code, integer) to anon, authenticated;

create index if not exists tmz_person_tr_name_idx on tmz_person_tr (lower(display_name));
