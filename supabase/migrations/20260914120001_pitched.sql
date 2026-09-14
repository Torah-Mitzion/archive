/* The ask to share the archive goes out once per sender, after their first
   photograph is published. This is where "once" is remembered. */
alter table tmz_wa_contact add column if not exists pitched_at timestamptz;
comment on column tmz_wa_contact.pitched_at is 'When the share-the-archive messages were sent to this contact (once).';
