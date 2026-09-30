/* The photographs list, flattened so it can be sorted and paged by the server.
 *
 * The back office drew the newest two hundred and stopped. With 642
 * photographs on the site that is 442 nobody could reach from this page at
 * all, and no amount of scrolling would have found them. Paging is the fix,
 * and paging only works if the ordering is the database's: a page of results
 * sorted in the browser is a page sorted against itself.
 *
 * Sorting by community or by who sent it needs a name, and a name lives two
 * joins away — so the joins happen here, once, rather than in four different
 * queries that each order by something they cannot see. Everything the list
 * draws is a plain column of this view, which also means no PostgREST embeds:
 * a view has no foreign keys to embed through, and the list no longer needs
 * any.
 *
 * security_invoker, so the caller's own row policies decide what they see.
 * The view adds no access; it only saves four joins.
 */
create or replace view tmz_photo_board with (security_invoker = true) as
select
  p.id,
  p.created_at,
  p.published_at,
  p.year,
  p.status,
  p.source,
  p.agent_decision,
  p.published_by,
  p.storage_path,
  p.derived_path,
  p.public_path,
  p.portrait_of,
  p.portrait_name,
  p.submitter_ref,
  p.community_id,
  p.edit,
  c.slug                                           as community_slug,
  coalesce(tr.name, c.slug)                        as community_name,
  /* Who sent it, by the best name anyone has for them: what they told the
     agent, else what the provider calls them, else what they typed into the
     contribute form. */
  coalesce(nullif(wa.person_name, ''), nullif(wa.display_name, ''),
           nullif(sub.contributor_name, ''))       as submitter_name,
  case when p.submitter_ref like 'wa:%'
       then substring(p.submitter_ref from 4) end  as submitter_phone,
  nullif(sub.contributor_email, '')                as submitter_email,
  wa.strikes                                       as submitter_strikes,
  wa.blocked_until                                 as submitter_blocked_until,
  why.reasons                                      as why
from tmz_photo p
left join tmz_community c      on c.id = p.community_id
left join tmz_community_tr tr  on tr.community_id = c.id and tr.lang = 'en'
left join tmz_wa_contact wa    on wa.ref = p.submitter_ref
left join tmz_submission sub   on sub.id = p.submission_id
/* The screener speaks twice and the refusal is the last word, but the decision
   is only written on the final pass. Prefer that one; fall back to the first
   thing it said, which is what the old list did in the browser. */
left join lateral (
  select coalesce(
    (select m.reasons from tmz_moderation m
      where m.photo_id = p.id and m.decision = 'reject'
      order by m.decided_at desc limit 1),
    (select m.reasons from tmz_moderation m
      where m.photo_id = p.id
      order by m.decided_at asc limit 1)
  ) as reasons
) why on true;

comment on view tmz_photo_board is
  'The back office photographs list: one flat row per photograph, with the community, the sender and the refusal reasons already joined, so the server can order, group and page it.';

revoke all on tmz_photo_board from anon;
grant select on tmz_photo_board to authenticated;

/* How many photographs in each group, for the whole tab rather than the page
   in front of you. Without it a group heading could only count what happens to
   be on this page, which is the least interesting number it could show. */
create or replace function tmz_photo_groups(want text default 'all', by text default 'community')
returns table (key text, n bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  st tmz_photo_status;
begin
  if not tmz_is_staff() then
    raise exception 'tmz_photo_groups is for staff' using errcode = '42501';
  end if;
  st := case want when 'approved' then 'approved'::tmz_photo_status
                  when 'pending'  then 'pending'::tmz_photo_status
                  when 'rejected' then 'rejected'::tmz_photo_status end;

  return query
  select g.key, count(*)::bigint
  from (
    select case by
             when 'submitter' then coalesce(p.submitter_ref, '')
             when 'year'      then coalesce(p.year::text, '')
             else                  coalesce(c.slug, '')
           end as key
    from tmz_photo p
    left join tmz_community c on c.id = p.community_id
    where st is null or p.status = st
  ) g
  group by g.key;
end $$;

revoke all on function tmz_photo_groups(text, text) from public, anon;
grant execute on function tmz_photo_groups(text, text) to authenticated;
