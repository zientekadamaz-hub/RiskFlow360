import { NextResponse } from 'next/server'
import { supabaseServer } from '@app/lib/supabaseServer'
import { formatInviteRole, setOrganizationInvitationStatus } from '@/features/settings/invitations-service'
import { sendInvitationEmail } from '@/lib/invitation-email'
import { env } from '@/lib/env'

type HeaderRpcRow = {
  org_name?: string | null
  org_role?: string | null
  global_role?: string | null
}

type ActiveProfileRow = {
  active_organization_id?: string | null
}

type InvitationRow = {
  id: string
  accepted_by: string | null
  email: string
  first_name: string | null
  last_name: string | null
  organization_id: string
  role: string
  status: string
  token: string | null
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBasePath(value: string | undefined) {
  const raw = value?.trim() ?? ''
  if (!raw || raw === '/') return ''
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withLeadingSlash.replace(/\/+$/, '')
}

function getOrigin(request: Request) {
  if (env.publicAppUrl) return env.publicAppUrl.replace(/\/+$/, '')
  const origin = request.headers.get('origin') ?? ''
  if (origin) return origin.replace(/\/+$/, '')
  const host = request.headers.get('host') ?? '127.0.0.1:3000'
  const protocol = host.includes('127.0.0.1') || host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

function buildInviteUrl(request: Request, token: string) {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
  return `${getOrigin(request)}${basePath}/waiting-for-invite?token=${encodeURIComponent(token)}`
}

function mapInviteError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not resend invitation.'
  const lower = message.toLowerCase()
  if (lower.includes('license') || lower.includes('limit') || lower.includes('seats')) {
    return { message: 'License limit reached for your organization.', status: 409 }
  }
  if (lower.includes('not found')) {
    return { message: 'Invitation not found.', status: 404 }
  }
  return { message, status: 500 }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid request format.' }, { status: 415 })
    }

    const payload = (await request.json().catch(() => null)) as { invitationId?: unknown } | null
    const invitationId = normalizeString(payload?.invitationId)
    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation id is required.' }, { status: 400 })
    }

    const supabase = await supabaseServer()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const { data: invitationData, error: invitationError } = await supabase
      .from('organization_invitations')
      .select('id, organization_id, email, first_name, last_name, role, status, token, accepted_by')
      .eq('id', invitationId)
      .maybeSingle()

    if (invitationError) {
      return NextResponse.json({ error: invitationError.message }, { status: 500 })
    }

    const invitation = invitationData as InvitationRow | null
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
    }

    const [profileRes, headerRes] = await Promise.all([
      supabase.from('profiles').select('active_organization_id').eq('id', user.id).maybeSingle(),
      supabase.rpc('get_my_header').maybeSingle(),
    ])

    if (profileRes.error) {
      return NextResponse.json({ error: profileRes.error.message }, { status: 500 })
    }

    const activeOrganizationId = (profileRes.data as ActiveProfileRow | null)?.active_organization_id ?? null
    if (activeOrganizationId !== invitation.organization_id) {
      return NextResponse.json({ error: 'Invalid active organization.' }, { status: 403 })
    }

    const header = (headerRes.data as HeaderRpcRow | null) ?? {}
    const canInvite = header.global_role === 'admin' || header.org_role === 'champion'
    if (!canInvite) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }

    await setOrganizationInvitationStatus(supabase, {
      invitationId,
      status: 'PENDING',
    })

    const { data: refreshedData, error: refreshedError } = await supabase
      .from('organization_invitations')
      .select('id, organization_id, email, first_name, last_name, role, status, token, accepted_by')
      .eq('id', invitationId)
      .maybeSingle()

    if (refreshedError) {
      throw refreshedError
    }

    const refreshed = refreshedData as InvitationRow | null
    if (!refreshed?.token) {
      throw new Error('Invitation has no token.')
    }

    const inviteUrl = buildInviteUrl(request, refreshed.token)
    await sendInvitationEmail({
      email: refreshed.email,
      firstName: refreshed.first_name ?? '',
      lastName: refreshed.last_name ?? '',
      organizationName: header.org_name ?? 'your organization',
      role: formatInviteRole(refreshed.role),
      inviteUrl,
    })

    return NextResponse.json({
      email: refreshed.email,
      id: refreshed.id,
      inviteUrl,
      ok: true,
    })
  } catch (error) {
    console.error('[api/invitations/resend] failed', error)
    const mapped = mapInviteError(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
