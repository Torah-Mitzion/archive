/* The landing page said "1 photograph" over a community holding two. The
   map payload counted the rows of a by-year grouping — years with
   photographs, not photographs. Sum them. */

create or replace function tmz_map_payload(want tmz_lang_code default 'en')
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'lang', want,
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', tmz_region_name(r.id, want))
                       order by r.sort)
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
                and public_path is not null and year is not null
              group by year) x
      ) p on true
    ), '[]'::jsonb)
  );
$$;
