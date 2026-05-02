# Supabase Remediation Progress - 2026-04-22 - Pass 2

## Scope
Second live remediation pass focused on replacing broad authenticated access policies in:
- `pfd_drafts`
- `pfd_edit_sessions`
- `pfd_session_events`
- `pfd_change_history`
- `pfmea_edit_sessions`
- `pfmea_change_history`
- `pcp_edit_sessions`
- `pcp_change_history`

## Changes Applied To Live Supabase

### 1. Removed broad "any authenticated user" policies
Dropped these policies from the live project:
- `pfd_drafts_all_auth`
- `pfd_edit_sessions_all_auth`
- `pfd_session_events_all_auth`
- `pfd_change_history_all_auth`
- `pfmea_edit_sessions_all_auth`
- `pfmea_change_history_all_auth`
- `pcp_edit_sessions_all_auth`
- `pcp_change_history_all_auth`

### 2. Added project/org-scoped history policies
For:
- `pfd_change_history`
- `pfmea_change_history`
- `pcp_change_history`

New model:
- `SELECT`: any project member or global admin
- `INSERT`: project editor (`admin` / `champion` / `engineer`) or global admin
- no open `UPDATE` / `DELETE`

### 3. Added controlled session lock policies
For:
- `pfd_edit_sessions`
- `pfmea_edit_sessions`
- `pcp_edit_sessions`

New model:
- `SELECT`: any project member or global admin
- `INSERT`: only current authenticated editor can create own lock row
- `UPDATE` / `DELETE`:
  - lock owner
  - or timed-out session (`48h`)
  - or organization `admin` / `champion`
  - or global admin

This preserves:
- normal session heartbeat by lock owner
- timeout takeover by editors
- explicit takeover capability for `champion`

### 4. Added controlled PFD draft policies
For `pfd_drafts`:
- `SELECT`:
  - own draft
  - organization `admin` / `champion`
  - global admin
- `INSERT` / `UPDATE`:
  - only own draft
  - only editor/global admin
- `DELETE`:
  - own draft
  - or organization `admin` / `champion`
  - or global admin
  - or timed-out takeover path for project editor

### 5. Added controlled PFD session event policies
For `pfd_session_events`:
- `SELECT`: recipient only or global admin
- `INSERT`: project editor or global admin, with recipient validated inside same organization
- `UPDATE`: recipient only or global admin

## Files Saved In Repo
- SQL checkpoint: [2026-04-22_supabase_session_history_hardening.sql](</c:/Users/zieada/pfmea-app/db/2026-04-22_supabase_session_history_hardening.sql>)

## Validation

### Live DB validation
Confirmed:
- all 8 broad `auth.uid() IS NOT NULL` policies are gone
- these tables now expose only scoped policies
- a direct scan for remaining public policies with `auth.uid() IS NOT NULL` returned `0`

### App validation
- `npm run typecheck` passed
- `npm run build` passed

## Risk Reduction

### Resolved
- cross-tenant access risk in PFD/PFMEA/PCP session/history tables caused by blanket authenticated policies
- unrestricted authenticated access to PFD draft/session event data
- over-broad write surface for collaborative editing metadata

### Still Open
- invitation/admin helper functions still disable RLS internally
- `create_org_invitation`, `accept_invitation`, `set_invitation_status`, `is_org_admin_or_champion_v2` still need architectural tightening
- `projects` role model is still not fully aligned with desired business semantics, especially around delete/administrative actions
- least-privilege cleanup for remaining table grants is still pending

## Recommended Next Pass
1. Review and tighten invitation/admin functions that call `set_config('row_security', 'off', true)`
2. Align `projects` and related mutation rights with the agreed role contract:
   - global `admin`
   - org `champion`
   - `engineer` without delete/admin semantics
3. Review whether `FORCE ROW LEVEL SECURITY` should be enabled on the most sensitive business tables
