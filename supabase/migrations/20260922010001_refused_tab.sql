/* The back office can see who sent a photograph.
 *
 * A refusal is the one thing in this album that happens to a person: their
 * photograph was turned away, automatically, by a screener nobody reviews.
 * The office could see THAT it happened and not to whom — tmz_wa_contact
 * granted nothing to anyone, so the name and the language of the sender were
 * service-role-only, and the refused tab would have shown a phone number and
 * a shrug.
 *
 * Staff already see the number: it is on the photograph itself as
 * submitter_ref, and the requests table prints it. This adds the name, the
 * language they write in, and how many refusals they have had — which is what
 * anyone deciding whether to write back to them needs. Gated on
 * tmz_is_staff(), like every other table here.
 */
grant select on table tmz_wa_contact to authenticated;

drop policy if exists tmz_wa_contact_staff_read on tmz_wa_contact;
create policy tmz_wa_contact_staff_read on tmz_wa_contact
  for select to authenticated using (tmz_is_staff());

/* And the view that answers "who sent this and how do we reach them" in one
   query. security_invoker means it carries no privilege of its own: it reaches
   exactly as far as the policies above and no further. */
grant select on tmz_photo_sender to authenticated;
