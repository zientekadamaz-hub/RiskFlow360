import { supabase } from '@app/lib/supabaseBrowser'

export type CustomerModule = 'PFD' | 'PFMEA' | 'PCP'

export type CustomerProjectAccessMap = Record<
  string,
  {
    PFD: boolean
    PFMEA: boolean
    PCP: boolean
  }
>

type RoleRow = {
  role?: string | null
}

type ProjectOrgRow = {
  organization_id?: string | null
}

function emptyAccess() {
  return { PFD: false, PFMEA: false, PCP: false }
}

export function hasCustomerModuleAccess(
  map: CustomerProjectAccessMap,
  projectId: string,
  module: CustomerModule
) {
  return !!map[projectId]?.[module]
}

export async function loadOwnCustomerAccessMap(userId: string, projectIds?: string[]) {
  let query = supabase
    .from('customer_access_grants')
    .select('project_id,module')
    .eq('customer_user_id', userId)
    .eq('active', true)

  if (projectIds && projectIds.length > 0) {
    query = query.in('project_id', projectIds)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  const map: CustomerProjectAccessMap = {}

  for (const row of (data ?? []) as Array<{ project_id?: string | null; module?: string | null }>) {
    const projectId = (row.project_id ?? '').toString().trim()
    const moduleName = (row.module ?? '').toString().trim().toUpperCase() as CustomerModule
    if (!projectId || !['PFD', 'PFMEA', 'PCP'].includes(moduleName)) continue
    map[projectId] = map[projectId] ?? emptyAccess()
    map[projectId][moduleName] = true
  }

  return map
}

export async function loadOwnProjectMemberRole(projectId: string, userId: string) {
  const projectRes = await supabase.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
  const organizationId = (projectRes.data as ProjectOrgRow | null)?.organization_id ?? null

  if (!organizationId) {
    return null
  }

  const memberRes = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberRes.error) {
    throw memberRes.error
  }

  return (((memberRes.data as RoleRow | null)?.role ?? '').toString().trim().toLowerCase() || null)
}
