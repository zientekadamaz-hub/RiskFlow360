import type { SupabaseClient } from '@supabase/supabase-js'

export type AppRole = 'admin' | 'champion' | 'engineer' | 'viewer' | 'customer' | string
export type InviteStatus = 'PENDING' | 'ACTIVE' | 'NOACTIVE' | 'EXPIRED' | string

export type LicenseRow = {
  invites_allowed_total: number | null
  valid_to: string | null
}

export type InviteRow = {
  id: string
  source?: 'invitation' | 'member'
  invitation_id?: string | null
  member_id?: string | null
  user_id?: string | null
  email: string
  first_name: string | null
  last_name: string | null
  role: AppRole
  status: InviteStatus
  created_at: string | null
  accepted_at: string | null
  token?: string | null
}

export function normalizeInviteText(value: string | null | undefined) {
  return (value ?? '').toString().trim()
}

export function displayInviteStatus(row: Pick<InviteRow, 'status'>) {
  const raw = normalizeInviteText(row.status).toUpperCase()
  return raw || '-'
}

export function formatInviteRole(role: AppRole) {
  const raw = normalizeInviteText(role).toLowerCase()
  if (!raw) return '-'
  return raw.toUpperCase()
}

export async function fetchOrganizationLicense(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from('organization_license')
    .select('invites_allowed_total, valid_to')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as LicenseRow | null) ?? null
}

export async function fetchOrganizationInvites(supabase: SupabaseClient, organizationId: string) {
  const directoryRes = await supabase.rpc('list_org_member_directory', {
    p_org: organizationId,
  })

  if (!directoryRes.error) {
    return ((directoryRes.data ?? []) as InviteRow[]).map((row) => ({
      ...row,
      id: row.id,
      source: row.source ?? ('invitation' as const),
    }))
  }

  const { data, error } = await supabase
    .from('organization_invitations')
    .select('id, email, first_name, last_name, role, status, created_at, accepted_at, token')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as InviteRow[]).map((row) => ({
    ...row,
    invitation_id: row.id,
    source: 'invitation' as const,
  }))
}

export async function createOrganizationInvitation(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    email: string
    role: AppRole
    firstName: string
    lastName: string
  }
) {
  const { data, error } = await supabase.rpc('create_org_invitation', {
    p_org: params.organizationId,
    p_email: params.email,
    p_role: params.role,
  })

  if (error) {
    throw error
  }

  const created = Array.isArray(data) ? data[0] : data
  if (created?.id) {
    const { error: updateError } = await supabase
      .from('organization_invitations')
      .update({ first_name: params.firstName, last_name: params.lastName })
      .eq('id', created.id)

    if (updateError) {
      throw updateError
    }
  }

  return created as { id?: string | null; token?: string | null } | null
}

export async function updateOrganizationInvitation(
  supabase: SupabaseClient,
  params: {
    invitationId: string
    email: string
    role: AppRole
    firstName: string
    lastName: string
  }
) {
  const { error } = await supabase
    .from('organization_invitations')
    .update({
      email: params.email,
      role: params.role,
      first_name: params.firstName,
      last_name: params.lastName,
    })
    .eq('id', params.invitationId)

  if (error) {
    throw error
  }
}

export async function updateOrganizationMemberRole(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    userId: string
    role: AppRole
  }
) {
  const { error } = await supabase.rpc('set_org_member_role', {
    p_org: params.organizationId,
    p_user: params.userId,
    p_role: params.role,
  })

  if (error) {
    throw error
  }
}

export async function setOrganizationInvitationStatus(
  supabase: SupabaseClient,
  params: {
    invitationId: string
    status: 'NOACTIVE' | 'ACTIVE' | 'PENDING'
  }
) {
  const { error } = await supabase.rpc('set_invitation_status', {
    p_invite_id: params.invitationId,
    p_status: params.status,
  })

  if (error) {
    throw error
  }
}

export async function deleteOrganizationInvitation(supabase: SupabaseClient, invitationId: string) {
  const { error } = await supabase.from('organization_invitations').delete().eq('id', invitationId)

  if (error) {
    throw error
  }
}
