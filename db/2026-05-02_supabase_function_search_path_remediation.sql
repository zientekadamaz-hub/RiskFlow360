-- Live security remediation captured on 2026-05-02.
-- Non-destructive: pins search_path for public functions reported by Supabase advisors.

alter function public.calculate_rpn() set search_path = public, auth, extensions;
alter function public.can_edit() set search_path = public, auth, extensions;
alter function public.can_read() set search_path = public, auth, extensions;
alter function public.create_org_invitation_as(uuid, text, public.app_role, uuid) set search_path = public, auth, extensions;
alter function public.create_process_revision_and_tag_changes(uuid, text, boolean, boolean, boolean, uuid[], uuid[], uuid[], uuid[]) set search_path = public, auth, extensions;
alter function public.current_profile_role() set search_path = public, auth, extensions;
alter function public.get_detection_effective(uuid) set search_path = public, auth, extensions;
alter function public.get_occurrence_effective(uuid) set search_path = public, auth, extensions;
alter function public.get_severity_effective(uuid) set search_path = public, auth, extensions;
alter function public.handle_new_user() set search_path = public, auth, extensions;
alter function public.has_org_role(uuid, text[]) set search_path = public, auth, extensions;
alter function public.is_admin() set search_path = public, auth, extensions;
alter function public.is_org_admin_or_champion(uuid) set search_path = public, auth, extensions;
alter function public.is_org_member(uuid) set search_path = public, auth, extensions;
alter function public.is_owner_of_edge(uuid) set search_path = public, auth, extensions;
alter function public.is_owner_of_operation(uuid) set search_path = public, auth, extensions;
alter function public.pfmea_calc_scores() set search_path = public, auth, extensions;
alter function public.set_detection_override_audit() set search_path = public, auth, extensions;
alter function public.set_occurrence_override_audit() set search_path = public, auth, extensions;
alter function public.set_severity_override_audit() set search_path = public, auth, extensions;
alter function public.set_updated_at() set search_path = public, auth, extensions;
