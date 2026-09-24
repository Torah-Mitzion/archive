/* Cropping and turning a photograph, without ever touching the photograph.
 *
 * The master in tmz-photo-originals is the thing the archive exists to keep,
 * and nothing here writes to it. An edit is recorded as what it is — a
 * rotation and a rectangle — and the copies the site actually serves are
 * re-rendered from the master each time. So a crop can be loosened as easily
 * as it was tightened, two edits in a row do not compound into a quarter of
 * the picture, and nothing is ever re-compressed twice.
 *
 * Rotation is quarter turns and is applied first; the crop is then expressed
 * in fractions of the ROTATED image, which is the frame the person drawing the
 * rectangle was looking at.
 */
alter table tmz_photo add column if not exists edit jsonb;

comment on column tmz_photo.edit is
  'How the served copies are cut from the master: {"rot":0|90|180|270,"crop":{"x","y","w","h"} in fractions of the rotated image,"by","at"}. Null means the whole picture. The master is never modified.';

/* Staff could put new objects into the private bucket and read them, but not
   replace one — so re-rendering a photograph''s derivative and its thumbnail
   from the back office failed on the second edit, and only on the second.
   Reading and creating without replacing is not a coherent permission for the
   people who curate this. The master is protected by the code that never
   writes to it, and by the fact that an edit is stored rather than applied. */
do $$
begin
  if not exists (select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
                 where c.relname = 'objects' and p.polname = 'tmz staff replace derivatives') then
    create policy "tmz staff replace derivatives" on storage.objects
      for update to authenticated
      using (bucket_id = 'tmz-photo-originals' and tmz_is_staff())
      with check (bucket_id = 'tmz-photo-originals' and tmz_is_staff());
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
                 where c.relname = 'objects' and p.polname = 'tmz staff drop derivatives') then
    create policy "tmz staff drop derivatives" on storage.objects
      for delete to authenticated
      using (bucket_id = 'tmz-photo-originals' and tmz_is_staff());
  end if;
end $$;
