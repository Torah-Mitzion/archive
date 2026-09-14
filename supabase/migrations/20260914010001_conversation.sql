/* The conversation was thin on purpose — accept the photograph, ask which
 * community and year, done. Real use showed that was too thin: the archive
 * wants to know WHO is in a photograph and WHAT was happening, and a sender who
 * has just found a shoebox is exactly the person to ask. Those two answers
 * need somewhere to live. */

alter table tmz_photo
  add column people_text   text,
  add column occasion_text text;

comment on column tmz_photo.people_text is
  'Who the sender says is in the photograph, in their own words. Free text; tagging against tmz_person is a back-office job.';
comment on column tmz_photo.occasion_text is
  'What the sender says was happening, in their own words.';

/* The agent asks one question at a time and needs to remember which. It is
   about the sender, not the photograph: a shoebox is many photographs and one
   conversation. */
alter table tmz_wa_contact
  add column asking      text check (asking in ('community', 'year', 'people', 'occasion')),
  add column asking_for  uuid references tmz_photo(id) on delete set null,
  add column photos_sent integer not null default 0;

comment on column tmz_wa_contact.asking is
  'The question the agent last put to this sender, so their next message is read as the answer to it.';
