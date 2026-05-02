import type { SupabaseClient } from '@supabase/supabase-js'

export type InvitationPreview = {
  email: string
  first_name: string | null
  last_name: string | null
  organization_name: string | null
  role: string | null
  status: string | null
}

type ActivationResult = {
  user_id: string
  email: string
}

function normalizeRpcMessage(message: string) {
  return message.trim() || 'Operation could not be completed.'
}

export async function fetchInvitationPreview(supabase: SupabaseClient, token: string) {
  const { data, error } = await supabase.rpc('get_invitation_preview', {
    p_token: token,
  })

  if (error) {
    throw new Error(normalizeRpcMessage(error.message))
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    throw new Error('Invitation not found or no longer pending')
  }

  return row as InvitationPreview
}

export async function activateInvitedUser(supabase: SupabaseClient, token: string, password: string) {
  const { data, error } = await supabase.rpc('activate_invited_user', {
    p_token: token,
    p_password: password,
  })

  if (error) {
    throw new Error(normalizeRpcMessage(error.message))
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.email) {
    throw new Error('Invitation activation did not return an account email.')
  }

  return row as ActivationResult
}
