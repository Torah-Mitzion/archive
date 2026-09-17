/* What the agent learns about the SENDER, as opposed to about a photograph.
 *
 * Until now the agent knew a sender's language, the place and year they last
 * named, and nothing else. It asked for photographs from a stranger. But most
 * of the people who write to it are the album's own subjects — shlichim who
 * served somewhere between 1996 and today — and the register already holds
 * 1,634 of them by name, community and year. A sender who says "I was in
 * Munich in 2016" is not giving us a fact about a photograph; they are telling
 * us which row of the register they are, and once that is known their own
 * picture can go beside their name on the site.
 *
 * So the conversation now opens by getting to know them: what to call them,
 * whether they were a shaliach, and if so where and when. That is enough to
 * find them in the register, and then the agent can offer them the one thing
 * only they can give — a picture of themselves.
 *
 * These columns are about the person. The older community_id and year on this
 * table are the defaults for the NEXT PHOTOGRAPH they send, which is a
 * different thing and deliberately kept apart: someone who served in Munich
 * still sends photographs from a wedding in Cape Town.
 */
alter table tmz_wa_contact
  add column if not exists person_name           text,
  add column if not exists was_shaliach          boolean,
  add column if not exists shaliach_year         integer,
  add column if not exists shaliach_community_id uuid references tmz_community(id) on delete set null,
  add column if not exists person_id             uuid references tmz_person(id) on delete set null,
  add column if not exists intro_done_at         timestamptz,
  add column if not exists portrait_offered_at   timestamptz;

alter table tmz_wa_contact drop constraint if exists tmz_wa_contact_shaliach_year_check;
alter table tmz_wa_contact add constraint tmz_wa_contact_shaliach_year_check
  check (shaliach_year is null or shaliach_year between 1990 and 2200);

comment on column tmz_wa_contact.person_name is
  'What they said their name is — their own spelling, which is what the register is searched with.';
comment on column tmz_wa_contact.was_shaliach is
  'Whether they served with Torah MiTzion. NULL means they have not been asked or have not said; false is an answer and stops the asking.';
comment on column tmz_wa_contact.shaliach_year is
  'The year THEY served, not the year of any photograph.';
comment on column tmz_wa_contact.shaliach_community_id is
  'The community THEY served in. Narrows the register search: three people share a name, one of them served there.';
comment on column tmz_wa_contact.person_id is
  'The register row they turned out to be, once exactly one name matched. Their portrait goes on this person.';
comment on column tmz_wa_contact.intro_done_at is
  'The introduction is over: everything it asks for is either known or was declined. It never runs twice.';
comment on column tmz_wa_contact.portrait_offered_at is
  'A picture of themselves was offered. The next photograph they send with nothing else to say is that picture.';

/* The agent asks one question at a time and remembers which. Four of them are
   now about the person rather than the photograph. */
alter table tmz_wa_contact drop constraint if exists tmz_wa_contact_asking_check;
alter table tmz_wa_contact add constraint tmz_wa_contact_asking_check
  check (asking in ('community', 'year', 'people', 'occasion',
                    'name', 'shaliach', 'tenure', 'portrait'));

/* The console cleans up after itself; these columns go with the contact row,
   which tmz_sim_reset already deletes. Nothing to add there. */
