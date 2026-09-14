/* The anonymous key could read every column of every approved photograph,
   submitter_ref included - the WhatsApp number of whoever sent it. The site
   never reads the table directly; it reads six functions that each hand
   back only the columns a page shows. So the table closes to the public
   and the functions run as their owner. */
revoke select on tmz_photo from anon;

alter function tmz_map_payload(tmz_lang_code) security definer set search_path = public;
alter function tmz_year_payload(text, integer, tmz_lang_code) security definer set search_path = public;
alter function tmz_teaser(integer, tmz_lang_code) security definer set search_path = public;
alter function tmz_person_search(text, tmz_lang_code, integer, text) security definer set search_path = public;
alter function tmz_photo_people_search(text, tmz_lang_code, integer) security definer set search_path = public;
alter function tmz_community_overview(text, tmz_lang_code) security definer set search_path = public;
