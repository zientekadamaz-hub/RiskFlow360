-- Least-privilege hardening pass 2
-- Safe scope:
-- - remove unnecessary write/delete privileges where the app uses read-only or partial CRUD
-- - remove EXECUTE from trigger-only and unused helper functions

revoke insert, update, delete
on table public.organization_license
from authenticated;

revoke insert, update, delete
on table public.organization_members
from authenticated;

revoke insert, update, delete
on table public.profiles
from authenticated;

revoke select, insert, update, delete
on table public.process_revisions
from authenticated;

revoke insert, update, delete
on table public.severity_defaults
from authenticated;

revoke insert, update, delete
on table public.occurrence_defaults
from authenticated;

revoke insert, update, delete
on table public.detection_defaults
from authenticated;

revoke delete
on table public.operations
from authenticated;

revoke insert
on table public.organization_invitations
from authenticated;

revoke update, delete
on table public.pfd_change_history
from authenticated;

revoke delete
on table public.pfd_diagrams
from authenticated;

revoke delete
on table public.pfd_session_events
from authenticated;

revoke update, delete
on table public.pfmea_change_history
from authenticated;

revoke update, delete
on table public.pcp_change_history
from authenticated;

revoke execute on function public.calculate_rpn() from authenticated;
revoke execute on function public.pfmea_calc_scores() from authenticated;
revoke execute on function public.set_detection_override_audit() from authenticated;
revoke execute on function public.set_occurrence_override_audit() from authenticated;
revoke execute on function public.set_severity_override_audit() from authenticated;

revoke execute on function public.can_edit() from authenticated;
revoke execute on function public.can_read() from authenticated;
revoke execute on function public.current_profile_role() from authenticated;
revoke execute on function public.has_org_role(uuid, text[]) from authenticated;
revoke execute on function public.is_admin() from authenticated;
revoke execute on function public.is_org_member(uuid) from authenticated;
revoke execute on function public.is_owner_of_edge(uuid) from authenticated;
revoke execute on function public.is_owner_of_operation(uuid) from authenticated;
