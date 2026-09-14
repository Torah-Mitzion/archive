/* What went wrong with the last thing this sender sent us.
 *
 * The client's photographs were failing before screening and nobody could say
 * why: the function logged the reason, but the deploy token cannot read logs.
 * A guess was made and coded around. This is the end of guessing — the last
 * failure on a sender's conversation is written where it can be read. */

alter table tmz_wa_contact
  add column last_error    text,
  add column last_error_at timestamptz;

comment on column tmz_wa_contact.last_error is
  'The most recent failure handling a message from this sender, verbatim. Cleared on the next success.';
