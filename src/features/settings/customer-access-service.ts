import type { SupabaseClient } from '@supabase/supabase-js'

export type CustomerCandidateRow = {
  customer_user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  profile_active: boolean | null
}

export type CustomerAccessGrantRow = {
  grant_id: string
  customer_user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  project_id: string
  project_name: string | null
  module: 'PFD' | 'PFMEA' | 'PCP'
  active: boolean
  created_at: string | null
}

export type PendingCustomerInviteRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  status: string | null
  created_at: string | null
}

export type CustomerAccessProjectRow = {
  id: string
  name: string | null
  status: string | null
}

export async function fetchCustomerCandidates(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase.rpc('list_customer_access_candidates', {
    p_org: organizationId,
  })

  if (error) {
    throw error
  }

  return Array.isArray(data) ? (data as CustomerCandidateRow[]) : []
}

export async function fetchCustomerAccessGrants(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase.rpc('list_customer_access_grants', {
    p_org: organizationId,
  })

  if (error) {
    throw error
  }

  return Array.isArray(data) ? (data as CustomerAccessGrantRow[]) : []
}

export async function fetchPendingCustomerInvites(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from('organization_invitations')
    .select('id,email,first_name,last_name,status,created_at')
    .eq('organization_id', organizationId)
    .eq('role', 'customer')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as PendingCustomerInviteRow[]
}

export async function fetchOrganizationProjects(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,status')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as CustomerAccessProjectRow[]
}

export async function setCustomerAccessGrant(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    customerUserId: string
    projectId: string
    module: 'PFD' | 'PFMEA' | 'PCP'
    enabled: boolean
  }
) {
  const { error } = await supabase.rpc('set_customer_access_grant', {
    p_org: params.organizationId,
    p_customer_user_id: params.customerUserId,
    p_project_id: params.projectId,
    p_module: params.module,
    p_enabled: params.enabled,
  })

  if (error) {
    throw error
  }
}
