-- Set WATLOW demo organization license to 10 seats.

update public.organization_license ol
set seats_purchased = 10,
    invites_allowed_total = 10,
    updated_at = now()
from public.organizations o
where ol.organization_id = o.id
  and lower(o.name) = 'watlow';
