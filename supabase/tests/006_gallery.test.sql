begin;
select plan(9);

insert into tmz_region (id, sort) values ('na', 1) on conflict (id) do nothing;
insert into tmz_region_tr (region_id, lang, name) values ('na', 'en', 'North America')
  on conflict (region_id, lang) do nothing;

insert into tmz_community (id, slug, region_id, lat, lon, founded_year) values
  ('22222222-2222-2222-2222-222222222222', 'gal-memphis', 'na', 35.15, -90.05, 2001),
  ('33333333-3333-3333-3333-333333333333', 'gal-chicago', 'na', 41.88, -87.63, 1996);
insert into tmz_community_tr (community_id, lang, name) values
  ('22222222-2222-2222-2222-222222222222', 'en', 'Memphis'),
  ('22222222-2222-2222-2222-222222222222', 'he', 'ממפיס'),
  ('33333333-3333-3333-3333-333333333333', 'en', 'Chicago');

-- Memphis: three public photographs over two years, one pending, one portrait.
-- Chicago: one. Publication times are set by hand so the order is not luck.
insert into tmz_photo (id, community_id, year, storage_path, public_path, status, taken_on, published_at) values
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 2007, 'a.jpg', 'pub/a.jpg', 'approved', '2007-03-01', '2026-09-01'),
  ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 2007, 'b.jpg', 'pub/b.jpg', 'approved', '2007-01-15', '2026-09-03'),
  ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 2009, 'c.jpg', 'pub/c.jpg', 'approved', null,         '2026-09-02'),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 2010, 'd.jpg', 'pub/d.jpg', 'pending',  null,         null),
  ('a0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 2003, 'e.jpg', 'pub/e.jpg', 'approved', null,         '2026-09-04');

select is((tmz_gallery('gal-memphis', 12, 'en') ->> 'total')::int, 3,
          'the total counts only the approved, public photographs of that community');

select is((tmz_gallery('gal-memphis', 12, 'en') -> 'photos' -> 0 ->> 'id'), 'a0000000-0000-0000-0000-000000000002',
          'the newest publication comes first');

select is((tmz_gallery('gal-memphis', 2, 'en') -> 'photos')::text ~ 'a0000000-0000-0000-0000-000000000001', false,
          'n caps the photographs returned, and the cap drops the oldest');

select is((tmz_gallery('gal-memphis', 12, 'he') -> 'photos' -> 0 ->> 'community_name'), 'ממפיס',
          'names resolve into the requested language');

select is(jsonb_array_length(tmz_gallery('gal-memphis', 12, 'en') -> 'covers'), 2,
          'one cover per year that has photographs');

select is((tmz_gallery('gal-memphis', 12, 'en') -> 'covers' -> 0 ->> 'id'), 'a0000000-0000-0000-0000-000000000002',
          'the cover of a year is its earliest photograph, so it does not change as more arrive');

select is(jsonb_array_length(tmz_gallery(null, 12, 'en') -> 'covers'), 0,
          'album-wide there are no covers: the landing gallery does not need them');

select ok((tmz_gallery(null, 12, 'en') ->> 'total')::int >= 4,
          'with no community the pool is the whole album');

select ok(has_function_privilege('anon', 'tmz_gallery(text, integer, tmz_lang_code)', 'execute'),
          'the public site may call it');

select * from finish();
rollback;
