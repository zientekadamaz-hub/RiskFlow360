-- Remove Oliwia Zientek from organization membership while keeping global admin.
-- Execute only with database-level admin access / service_role migration path.

begin;

delete from public.organization_members
where user_id = '1410956e-a682-486f-9f0d-c05b1823a1e3';

update public.profiles
set active_organization_id = null
where id = '1410956e-a682-486f-9f0d-c05b1823a1e3';

commit;
