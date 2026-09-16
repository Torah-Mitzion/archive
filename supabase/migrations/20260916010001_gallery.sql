/* The photographs come forward.
 *
 * The client's note on the site: the map is large and it is not clear how
 * one gets to the photographs, or how the thing is built. Fair. The landing
 * page showed six random thumbnails in a strip beside the credit line, the
 * dots on the map gave no hint that anything lay behind them, and the
 * community page a visitor reached from a dot was a bar chart with no
 * picture on it.
 *
 * Two pages change, and both read this one function:
 *
 *   tmz_gallery(null, n, lang)  the newest n photographs album-wide, for the
 *                               gallery that now sits beside the map and
 *                               follows the pointer from community to
 *                               community;
 *   tmz_gallery(slug, n, lang)  the same for one community, plus one cover
 *                               photograph per year, for the community page,
 *                               whose years are now a sheet of photographs
 *                               rather than bars.
 *
 * It says only what the year pages already print: approved photographs with
 * a public copy, portraits excluded, each caption resolved into the requested
 * language with the same fallback the year payload uses. Newest first, by
 * the moment of publication; a cover is the earliest photograph of its year,
 * so it does not change every time another arrives. Security definer like
 * the other readers, because the table itself is closed to the public. */

create or replace function tmz_gallery(community_slug text default null, n integer default 12,
                                       want tmz_lang_code default 'en')
returns jsonb language sql stable security definer set search_path = public as $$
  with pool as (
    select ph.id, ph.public_path, ph.year, ph.taken_on, ph.created_at, ph.published_at,
           ph.event_type_id, ph.people_text, ph.people_tr, ph.occasion_text, ph.occasion_tr,
           co.slug as community, tmz_community_name(co.id, want) as community_name
    from tmz_photo ph join tmz_community co on co.id = ph.community_id
    where ph.status = 'approved' and ph.public_path is not null
      and ph.year is not null and ph.portrait_of is null
      and (community_slug is null or co.slug = community_slug)
  ),
  newest as (
    select *, row_number() over (order by coalesce(published_at, created_at) desc, id) as ord
    from pool
  )
  select jsonb_build_object(
    'total', (select count(*) from pool),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'path', p.public_path, 'year', p.year,
        'community', p.community, 'community_name', p.community_name,
        'event_name', (select name from tmz_event_type_tr et
                       where et.event_type_id = p.event_type_id
                       order by (et.lang = want) desc, (et.lang = 'en') desc limit 1),
        'people_text', coalesce(p.people_tr ->> want::text, p.people_text),
        'occasion_text', coalesce(p.occasion_tr ->> want::text, p.occasion_text),
        'taken_on', p.taken_on)
        order by p.ord)
      from newest p
      where p.ord <= greatest(1, least(coalesce(n, 12), 60))), '[]'::jsonb),
    'covers', case when community_slug is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('year', k.year, 'id', k.id, 'path', k.public_path)
                       order by k.year)
      from (select distinct on (year) year, id, public_path
            from pool order by year, taken_on nulls last, created_at, id) k), '[]'::jsonb) end
  );
$$;
grant execute on function tmz_gallery(text, integer, tmz_lang_code) to anon, authenticated;
