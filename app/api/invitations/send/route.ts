import { NextResponse } from 'next/server'
import { supabaseServer } from '@app/lib/supabaseServer'
import { createOrganizationInvitation, formatInviteRole, type AppRole } from '@/features/settings/invitations-service'
import { sendInvitationEmail } from '@/lib/invitation-email'
import { env } from '@/lib/env'

type HeaderRpcRow = {
  org_name?: string | null
  org_role?: string | null
  global_role?: AppRole | null
}

type ActiveProfileRow = {
  active_organization_id?: string | null
}

type SendInvitationPayload = {
  email?: unknown
  firstName?: unknown
  lastName?: unknown
  organizationId?: unknown
  role?: unknown
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRole(value: unknown): AppRole {
  const role = normalizeString(value).toLowerCase()
  if (['champion', 'engineer', 'viewer', 'customer'].includes(role)) return role
  return 'engineer'
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
  const message = error instanceof Error ? error.message : 'Could not send invitation.'
  const lower = message.toLowerCase()
  if (lower.includes('license') || lower.includes('limit') || lower.includes('seats')) {
    return { message: 'License limit reached for your organization.', status: 409 }
  }
  if (lower.includes('already exists') && lower.includes('email')) {
    return { message: 'A user with this email already exists. Use a different email address.', status: 409 }
  }
  if (lower.includes('invitation') && (lower.includes('exists') || lower.includes('duplicate') || lower.includes('unique'))) {
    return { message: 'An invitation for this email already exists in your organization.', status: 409 }
  }
  return { message, status: 500 }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Invalid request format.' }, { status: 415 })
    }

    const payload = (await request.json().catch(() => null)) as SendInvitationPayload | null
    if (!payload) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const email = normalizeString(payload.email).toLowerCase()
    const firstName = normalizeString(payload.firstName)
    const lastName = normalizeString(payload.lastName)
    const organizationId = normalizeString(payload.organizationId)
    const role = normalizeRole(payload.role)

    if (!email || !firstName || !lastName || !organizationId) {
      return NextResponse.json({ error: 'Email, first name, last name and organization are required.' }, { status: 400 })
    }

    const supabase = await supabaseServer()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const [profileRes, headerRes] = await Promise.all([
      supabase.from('profiles').select('active_organization_id').eq('id', user.id).maybeSingle(),
      supabase.rpc('get_my_header').maybeSingle(),
    ])

    if (profileRes.error) {
      return NextResponse.json({ error: profileRes.error.message }, { status: 500 })
    }

    const activeOrganizationId = (profileRes.data as ActiveProfileRow | null)?.active_organization_id ?? null
    if (activeOrganizationId !== organizationId) {
      return NextResponse.json({ error: 'Invalid active organization.' }, { status: 403 })
    }

    const header = (headerRes.data as HeaderRpcRow | null) ?? {}
    const canInvite = header.global_role === 'admin' || header.org_role === 'champion'
    if (!canInvite) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }

    const created = await createOrganizationInvitation(supabase, {
      organizationId,
      email,
      role,
      firstName,
      lastName,
    })

    if (!created?.token) {
      return NextResponse.json({ error: 'Invitation was created without a token.' }, { status: 500 })
    }

    const inviteUrl = buildInviteUrl(request, created.token)
    await sendInvitationEmail({
      email,
      firstName,
      lastName,
      organizationName: header.org_name ?? 'your organization',
      role: formatInviteRole(role),
      inviteUrl,
    })

    return NextResponse.json({
      email,
      id: created.id ?? null,
      inviteUrl,
      ok: true,
    })
  } catch (error) {
    console.error('[api/invitations/send] failed', error)
    const mapped = mapInviteError(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
