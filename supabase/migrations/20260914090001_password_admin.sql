/* The back office signs in with a username and password now, not Google.
   The username is a synthetic address on the site's own domain, so it can
   never receive mail and never needs to. Its row is promoted to admin on
   creation, the same way the bootstrap e-mail is, so a re-created profile
   cannot demote it. */
create or replace function tmz_bootstrap_admin() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  my_email text;
begin
  select email into my_email from auth.users where id = new.id;
  if lower(coalesce(my_email, '')) in ('hagai.rettig@gmail.com', 'tmzadmin@30.torahmitzion.org') then
    new.role := 'admin';
  end if;
  return new;
end;
$$;
