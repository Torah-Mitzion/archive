/* Who sent each photograph, and how to reach them.
 *
 * The information was already there and unusable. Every photograph carries
 * tmz_photo.submitter_ref — 'wa:<phone>' for the agent, a hashed address for
 * the contribute page — and that is the way back to the person who sent it.
 * But there was no index on it, so every lookup was a sequential scan over the
 * whole table, and no name to go with the number: the WhatsApp provider does
 * not send a profile name, so contributor_name was null on all 110 submissions
 * the agent had taken. The introduction now asks, and what it hears is written
 * onto the submissions behind the photographs they have already sent.
 *
 * The index matters more than it looks: whoever sent a photograph may now
 * correct it themselves, and the agent establishes that by looking up their
 * own photographs on every message.
 */

create index if not exists tmz_photo_submitter_ref_idx on tmz_photo (submitter_ref, created_at desc);

comment on column tmz_photo.submitter_ref is
  'Who sent this photograph: ''wa:<phone>'' from the WhatsApp agent — the same key as tmz_wa_contact.ref — or a hashed address from the contribute page. The agent lets whoever sent a photograph correct it, and this column is what establishes that.';

/* One place to answer "who sent this, and how do we reach them". Staff only:
   security_invoker makes the view obey the policies of the tables under it,
   and tmz_wa_contact grants nothing to anon or authenticated, so this reaches
   no further than the service role already does. Without security_invoker a
   view runs as its owner and would have handed every telephone number to the
   public API. */
create or replace view tmz_photo_sender with (security_invoker = true) as
select ph.id                     as photo_id,
       ph.submitter_ref,
       case when ph.submitter_ref like 'wa:%' then substr(ph.submitter_ref, 4) end as whatsapp,
       coalesce(c.person_name, s.contributor_name, c.display_name) as name,
       s.contributor_email        as email,
       coalesce(c.lang, s.lang)   as lang,
       c.person_id,
       ph.created_at              as sent_at
from tmz_photo ph
left join tmz_submission s   on s.id = ph.submission_id
left join tmz_wa_contact c   on c.ref = ph.submitter_ref;

revoke all on tmz_photo_sender from anon, authenticated;

comment on view tmz_photo_sender is
  'Who sent each photograph and how to reach them. Not public: no grant to anon or authenticated, and security_invoker keeps the policies of the tables beneath it.';
