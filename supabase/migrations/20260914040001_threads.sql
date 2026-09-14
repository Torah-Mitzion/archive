/* Which photograph is this about?
 *
 * One person sending five photographs in a row, and an agent asking "which
 * community?" five times, is a mess unless each question visibly hangs off
 * the photograph it is about — and unless the answer "Memphis" can be tied
 * back to the right one. WhatsApp has the mechanism: a reply quotes a message.
 * These two columns let the agent use it in both directions. */

alter table tmz_wa_message
  add column provider_msg_id text;

comment on column tmz_wa_message.provider_msg_id is
  'The messaging provider''s own id for this message. Outbound: so the agent can quote its own question. Inbound: so the user''s quote of a message can be found.';

create index tmz_wa_message_provider_idx on tmz_wa_message (provider_msg_id)
  where provider_msg_id is not null;

/* What the photograph shows, in a sentence, from the screener — so the agent
   can ask "do you mean the one with three people by the flag?" when a reply
   could be about more than one. */
alter table tmz_photo
  add column ai_description text;
