/* The sender's language is whatever they write in, not one of six.
 *
 * tmz_wa_contact.lang and tmz_submission.lang were the tmz_lang_code enum —
 * en/he/ru/fr/de/es — because the *_tr tables are, and it looked tidy to
 * share the type. It was not tidy: the first Arabic speaker's contact row
 * failed the enum silently, so the agent forgot them between messages and
 * welcomed them twice, the second time in Hebrew.
 *
 * The translation tables keep the enum; they really do hold six languages.
 * A person's language is free text, an ISO code, any code. */

alter table tmz_wa_contact alter column lang type text using lang::text;
alter table tmz_submission alter column lang type text using lang::text;

comment on column tmz_wa_contact.lang is
  'ISO code of the language this sender writes in — any language, not only the six the site is translated into.';
