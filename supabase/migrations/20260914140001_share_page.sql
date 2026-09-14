/* When a photograph's share page (docs/p/<id>.html on the site) was last
   written, so the watchdog knows which published photographs still lack one. */
alter table tmz_photo add column if not exists share_page_at timestamptz;
