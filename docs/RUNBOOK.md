# Runbook — standing the archive up on Torah MiTzion's own accounts

Commands to run, in order. Companion to [`MIGRATION.md`](MIGRATION.md), which
explains *why*; this is only *what to type*.

**Done already:** the code is in
[`Torah-Mitzion/archive`](https://github.com/Torah-Mitzion/archive) and GitHub
Pages serves it at <https://torah-mitzion.github.io/archive/>. It still reads
the old shared Supabase project — step 4 is what changes that.

---

## 1. Create the Supabase project

New project in Torah MiTzion's own organisation, **free plan**, region
`eu-central-1`. Save the database password it shows once.

Then collect three values from the dashboard:

| Value | Where |
|---|---|
| Project Ref | in the URL: `supabase.com/dashboard/project/<REF>` |
| `anon` key | Project Settings → API Keys |
| `service_role` key | same page — **secret, never committed** |

And one personal access token from <https://supabase.com/dashboard/account/tokens>
(`sbp_…`), which is what the CLI authenticates with.

## 2. Point the tooling at it

```bash
cd C:\Users\rettig_h\TMZ_site
```

Rewrite `.env.supabase` (it is gitignored and never leaves the machine):

```
SUPABASE_PROJECT_REF=<REF>
SUPABASE_URL=https://<REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_ACCESS_TOKEN=sbp_<personal token>
```

## 3. Schema and data

```bash
./node_modules/.bin/supabase link --project-ref <REF>
```

```bash
./node_modules/.bin/supabase db push --linked
```

Twenty-four migrations, in `supabase/migrations/`. They create the tables, the
RLS policies, the two storage buckets and the payload functions.

*If the CLI is awkward*, `supabase/schema.sql` is the same statements in one
file to paste into the dashboard's SQL editor — but prefer the push: it also
records what ran in `supabase_migrations.schema_migrations`, and without that
history the next migration you add will try to re-run everything.

Then the real communities, people and tenures:

```bash
node scripts/import-real.mjs
```

Expect `communities: 23 · people: 231 · tenures: 236`. No photographs — there
are none yet, which is why this migration is cheap.

## 4. Repoint the site at the new project

Three files carry the project's identity. Both values are public by design —
RLS is what enforces access — so they are committed.

```bash
node scripts/repoint.mjs <REF> <anon key>
```

```bash
git add -A && git commit -m "Point the site at Torah MiTzion's own project" && git push tmz master
```

## 5. The back office sign-in

The back office signs in with a username and password — no Google. The
username is a synthetic address on the site's domain (`tmzadmin` is
`tmzadmin@30.torahmitzion.org`); nothing is ever mailed to it. Create the
account from the Supabase dashboard (Authentication → Users → Add user, tick
"auto confirm") or with the admin API, then promote it:

```sql
update tmz_app_user set role = 'admin' where id = '<their auth.users id>';
```

**In the dashboard, Authentication → Sign In / Providers → turn "Allow new
users to sign up" OFF.** Otherwise anyone can register an account at the
password endpoint. (The API token used for the migration cannot change this
setting; it has to be clicked.) Passwords: minimum 10 characters is sensible.

## 6. Secrets for the edge functions

```bash
./node_modules/.bin/supabase secrets set --project-ref <REF> \
  GEMINI_API_KEY=<key with billing enabled> \
  TMZ_IP_SALT=$(openssl rand -hex 32) \
  SIM_TOKEN=$(openssl rand -base64 24 | tr -d '=+/') \
  HEYY_WEBHOOK_SECRET=$(openssl rand -base64 24 | tr -d '=+/') \
  HEYY_API_TOKEN=<from app.heyy.io/settings/api-keys> \
  HEYY_CHANNEL_ID=<the WhatsApp channel's id in Heyy> \
  AUTO_PUBLISH=off
```

**`AUTO_PUBLISH=off` deliberately.** Screening still runs and still records
every verdict; nothing reaches the site. Watch what it *would* have done for a
week, then set it to `on`. With no approval step, a photograph the agent refuses
is refused for good — so the dials want setting before the campaign, not during.

```bash
./node_modules/.bin/supabase functions deploy tmz-upload   --use-api --no-verify-jwt --project-ref <REF>
./node_modules/.bin/supabase functions deploy tmz-whatsapp --use-api --no-verify-jwt --project-ref <REF>
./node_modules/.bin/supabase functions deploy tmz-chat     --use-api --no-verify-jwt --project-ref <REF>
./node_modules/.bin/supabase functions deploy tmz-share    --use-api --no-verify-jwt --project-ref <REF>
```

`tmz-chat` is the site's floating guide. It reads the same `GEMINI_API_KEY`
and knows only what the year pages print (`tmz_chat_facts()`), so there is
nothing to configure beyond deploying it.

`tmz-share` is the page a messenger reads when someone passes on a link to
one photograph: `/functions/v1/tmz-share?p=<photo id>` carries Open Graph
tags whose image is the photograph itself, then sends the person on to the
site — so the preview shows the picture rather than the map.

## 7. Connect Heyy

**First, in Heyy, switch off its own AI on the archive's channel** — Settings →
AI Employees / Automations, channel "תורה מציון- 5". Two bots on one number
answer each other's customers; the client's first test showed Heyy's assistant
replying "how can I help you today?" to a photograph.

In Heyy → Settings → Webhooks → Create webhook, subscribed to
**`message.received`**:

```
https://<REF>.supabase.co/functions/v1/tmz-whatsapp?heyy=<HEYY_WEBHOOK_SECRET>
```

Then check it, without touching the real number:

```bash
node scripts/heyy-check.mjs
```

It posts a Heyy-shaped event, confirms a wrong secret is refused, and confirms
a real one is accepted and placed.

## 7a. What the agent does on its own

- **Portraits.** A sender who says a photograph is of themselves ("this is me,
  Avi Kannai" — as a caption or a message about a photograph) has the name
  matched against the register. One match links it; after screening the
  picture becomes that person's portrait on every year page they appear on
  (`tmz_person.portrait_path`). Several matches are narrowed by the community
  the photograph is placed in, otherwise the sender is asked which; no match
  asks for the spelling. The back office can clear `portrait_path` on a
  person to take a portrait down.
- **The moment it goes up.** A published photograph is announced with a link
  that opens on that very picture (`…/#/c/<community>/<year>/<photo id>`).
  The first time it happens for a sender, three more messages follow — the
  ask to share, a forwardable message with the site and the WhatsApp link
  (`SITE_URL`, `WHATSAPP_PUBLIC_NUMBER`; defaults are the live values), and
  the thanks with the portrait hint — and never again for that sender
  (`tmz_wa_contact.pitched_at`).
- **Publishing by hand.** Moderation → Open a photograph → set community
  and year → **Publish**. That records a staff verdict in place of the
  screener's; the watchdog puts it on the site within two minutes, tells
  the sender and writes the share page. Useful for a photograph the
  screener held (could not reach a verdict) or one whose sender never
  answered.
- **What a photograph needs to go up: a community and a year.** Nothing
  else. The agent asks for those two, one at a time, and publishes the
  moment both are known. Who is in it and the occasion are asked for once,
  in the message that carries the link, and added under the photograph
  whenever they arrive - the same way a correction is.
- **Requests.** When a sender asks for something the agent must not do
  alone — take a photograph down, fix a name in the register, "I am in that
  picture" — it opens a request (`tmz_request`) and says the team will
  answer. The back office's **Requests** tab lists them; resolving one
  (Done / Declined, with an optional note) has the watchdog send the note to
  the sender word for word within two minutes. "Take down and close" removes
  the public copy in the same click.
- **Reminders.** The watchdog nudges once, a day later, about a photograph
  that passed screening but still lacks a community or a year (the two things
  without which it has no page). Never more than once per photograph, never
  to a blocked or test sender.

## 7a½. Share pages

A link to one photograph is `https://30.torahmitzion.org/p/<id>.html` — a
static page in the site's repository whose preview image is the photograph.
Give the functions a fine-grained GitHub token (contents: read/write on
`Torah-Mitzion/archive`) as the secret `GITHUB_TOKEN` and they commit the
page the moment a photograph is published; the watchdog fills in any it
missed. Without the token, run `node scripts/share-pages.mjs` and push.

## 7b. Arm the watchdog

The sweep runs every two minutes from `pg_cron` and needs its URL (with the
secret) in a service-role-only table — never in git:

```bash
curl -s -X POST -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"   -H 'Content-Type: application/json' -H 'Prefer: resolution=merge-duplicates'   -d "[{\"key\":\"sweep_url\",\"value\":\"$SUPABASE_URL/functions/v1/tmz-whatsapp?sweep=$HEYY_WEBHOOK_SECRET\"}]"   "$SUPABASE_URL/rest/v1/tmz_settings?on_conflict=key"
```

Confirm it fires: `supabase db query "select start_time,status from cron.job_run_details order by start_time desc limit 3" --linked`.

## 8. Subdomain

Add one DNS record at whoever hosts `torahmitzion.org`:

```
archive   CNAME   torah-mitzion.github.io.
```

Then in the repo's Settings → Pages → Custom domain, enter
`archive.torahmitzion.org` and tick Enforce HTTPS once the certificate issues
(minutes to an hour).

## 9. Before telling anybody the number

```bash
node scripts/smoke.mjs
```

Ten photographs through both doors, checking each lands where expected. Then
send a dozen of the organisation's **own** photographs through
`/sim/` and read the verdicts — that is the calibration pass, and it is the
part that cannot be skipped.

---

## What to keep out of git

`.env.supabase` is gitignored and must stay that way. It holds the service-role
key, which bypasses every RLS policy in the project. The `anon` key in
`docs/api.js` is a different thing and is meant to be public.

## 10. Security notes

- **What the public can read:** `tmz_photo` is closed to the anonymous key;
  the site reads six `security definer` functions that return only the
  columns a page shows. Contact tables, messages, moderation and settings
  are service-role only. A sender's WhatsApp number never leaves the database.
- **Text people type** (names, occasion) is screened by the model before it
  is shown on a page; links, phone numbers and abuse are dropped, and a text
  the screener could not judge stays private until the watchdog can.
- **Rate limits:** 40 photographs and 60 messages per sender per hour; 20
  uploads and 40 guide questions per address per hour.
- **Portraits:** a name that already has a picture is not overwritten from
  WhatsApp; the back office swaps it (clear `tmz_person.portrait_path`).
- **Known medium risks, accepted:** the Heyy webhook is authenticated by a
  secret in its URL (Heyy signs nothing); the test console is a bearer token;
  a sender can attach any names to a photograph they send. **Turn off
  "Allow new users to sign up"** in Supabase Auth if not yet done.
