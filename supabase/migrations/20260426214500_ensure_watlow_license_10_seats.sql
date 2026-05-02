-- Ensure WATLOW demo organization has an organization_license row with 10 seats.

insert into public.organization_license (
  organization_id,
  seats_purchased,
  invites_allowed_total,
  valid_from,
  valid_to,
  created_at,
  updated_at
)
select
  o.id,
  10,
  10,
  current_date,
  null,
  now(),
  now()
from public.organizations o
where lower(o.name) = 'watlow'
on conflict (organization_id)
do update set
  seats_purchased = excluded.seats_purchased,
  invites_allowed_total = excluded.invites_allowed_total,
  valid_from = coalesce(public.organization_license.valid_from, excluded.valid_from),
  valid_to = excluded.valid_to,
  updated_at = now();
