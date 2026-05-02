-- Least-privilege hardening pass 1
-- Safe scope:
-- - revoke structural table privileges not needed by the app client
-- - restrict view access to read-only where the app only selects
-- - remove client EXECUTE from internal/trigger-only functions

revoke references, trigger, truncate
on all tables in schema public
from authenticated;

revoke insert, update, delete, references, trigger, truncate
on table public.projects_with_revision
from authenticated;

grant select
on table public.projects_with_revision
to authenticated;

revoke execute on function public.auto_generate_pcp() from authenticated;
revoke execute on function public.handle_auth_user_updated() from authenticated;
revoke execute on function public.handle_new_auth_user() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
revoke execute on function public.create_org_invitation_as(uuid, text, public.app_role, uuid) from authenticated;
revoke execute on function public.create_process_revision_and_tag_changes(
  uuid,
  text,
  boolean,
  boolean,
  boolean,
  uuid[],
  uuid[],
  uuid[],
  uuid[]
) from authenticated;
