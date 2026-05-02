# Supabase Invitation Flow Remediation - 2026-04-23 - Pass 1

## Scope
- move invitation acceptance to a professional token-first flow
- stop ambiguous "accept latest invitation by email" behavior
- make resend generate a fresh secure invitation link
- align frontend invitation UX with the hardened backend flow

## Changes Applied

### 1. Live Supabase SQL hardening
Applied to the live project from:
- [2026-04-23_supabase_professional_invitation_flow.sql](</c:/Users/zieada/pfmea-app/db/2026-04-23_supabase_professional_invitation_flow.sql>)

Updated functions:
- `public.accept_invitation()`
- `public.set_invitation_status(p_invite_id uuid, p_status text)`
- `public.set_invitation_status(p_org uuid, p_email text, p_status text)`

New behavior:
- `accept_invitation()` no longer silently picks the latest pending invite for the current email
- if there is no pending invite, it raises a clear error
- if there is more than one pending invite, it raises:
  - `Multiple pending invitations found. Use the invitation link.`
- if exactly one pending invite exists, the no-arg function delegates to the token-based function
- changing status back to `PENDING` now:
  - rotates `token`
  - clears `accepted_at`
  - clears `accepted_by`

### 2. `/waiting-for-invite` moved to token-first behavior
Updated:
- [app/waiting-for-invite/page.tsx](</c:/Users/zieada/pfmea-app/app/waiting-for-invite/page.tsx>)

New behavior:
- reads `?token=...` from the URL
- if the user is logged in and a token is present, acceptance runs automatically through:
  - `accept_invitation(p_token)`
- if the user is not logged in, the page sends them to login with the full tokenized return URL preserved
- if no token is present, the page now explains that a secure invitation link is required

### 3. Champion invitation page now exposes the real secure link
Updated:
- [app/settings/invitations/page.tsx](</c:/Users/zieada/pfmea-app/app/settings/invitations/page.tsx>)

New behavior:
- invitation reads now include `token`
- after creating an invitation, the page builds a shareable link:
  - `/waiting-for-invite?token=...`
- the page shows a ready-to-share invitation link panel
- per-row `Copy link` action was added
- resend now goes through backend status logic and reloads the row, so the new rotated token is used instead of reusing stale state

## Validation

### App validation
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed

### Live Supabase validation
Confirmed through Management API queries:
- `accept_invitation()` contains the multi-invite guard
- both `set_invitation_status(...)` variants rotate the token on `PENDING`
- both `set_invitation_status(...)` variants clear `accepted_at` and `accepted_by` on `PENDING`
- `EXECUTE` exposure stayed limited to:
  - `authenticated`
  - `service_role`
  - `postgres`

## Risk Reduction

### Resolved
- ambiguous acceptance of "latest" pending invitation by email
- stale invitation links after resend
- weak champion workflow where the system did not surface the exact acceptance link

### Remaining
- there is still no dedicated outbound email delivery flow in-app; champions currently copy/share the secure link manually
- `customer` access still needs a future granular permission model and separate invitation UX

## Recommended Next Step
1. add a dedicated email delivery path for invitation links
2. make invitation messages/templates explicit and consistent
3. later introduce per-module external access for `customer`
