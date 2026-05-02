import type { SupabaseClient } from '@supabase/supabase-js'

export type SiteDeptRow = {
  id: string
  organization_id: string
  site: string
  department: string
  active: boolean
  created_at: string
  project_count?: number
}

type ProfileOrgRow = {
  active_organization_id: string | null
}

type OrganizationNameRow = {
  name: string | null
}

type ProjectUsageRow = {
  site_department_id: string | null
}

type QueryError = {
  message: string
}

type QueryResult<T> = {
  data: T
  error: QueryError | null
}

const QUERY_TIMEOUT_MS = 1800

async function withTimeout<T>(
  promise: PromiseLike<{ data: T | null; error: QueryError | null }>,
  fallback: T
): Promise<QueryResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    const result = await Promise.race([
      promise,
      new Promise<QueryResult<T>>((resolve) => {
        timeoutId = setTimeout(() => resolve({ data: fallback, error: { message: 'timeout' } }), QUERY_TIMEOUT_MS)
      }),
    ])

    return {
      data: result.data ?? fallback,
      error: result.error,
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function toUserMessage(error: QueryError, timeoutMessage: string) {
  return error.message === 'timeout' ? timeoutMessage : error.message
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function mapSiteDepartmentWriteError(error: QueryError) {
  const message = error.message
  const lower = message.toLowerCase()

  if (lower.includes('projects_site_department_fk') || (lower.includes('foreign key') && lower.includes('projects'))) {
    return 'This site/department is used by existing projects and cannot be deleted. Reassign projects first.'
  }

  return message
}

export async function fetchSiteDepartmentContext(supabase: SupabaseClient, userId: string) {
  const profileResult = await withTimeout<ProfileOrgRow | null>(
    supabase.from('profiles').select('active_organization_id').eq('id', userId).maybeSingle(),
    null
  )

  if (profileResult.error) {
    throw new Error(toUserMessage(profileResult.error, 'Session read timeout. Try again.'))
  }

  const organizationId = profileResult.data?.active_organization_id ?? null
  if (!organizationId) {
    throw new Error('Uzytkownik nie ma ustawionej aktywnej organizacji.')
  }

  const [organizationResult, rowsResult, projectUsageResult] = await Promise.all([
    withTimeout<OrganizationNameRow | null>(
      supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
      null
    ),
    withTimeout<SiteDeptRow[]>(
      supabase
        .from('site_departments')
        .select('id, organization_id, site, department, active, created_at')
        .eq('organization_id', organizationId)
        .order('site', { ascending: true })
        .order('department', { ascending: true }),
      []
    ),
    withTimeout<ProjectUsageRow[]>(
      supabase.from('projects').select('site_department_id').eq('organization_id', organizationId),
      []
    ),
  ])

  if (rowsResult.error) {
    throw new Error(toUserMessage(rowsResult.error, 'Sites read timeout. Try again.'))
  }

  const usageCounts = new Map<string, number>()
  if (!projectUsageResult.error) {
    projectUsageResult.data.forEach((project) => {
      if (!project.site_department_id) return
      usageCounts.set(project.site_department_id, (usageCounts.get(project.site_department_id) ?? 0) + 1)
    })
  }

  return {
    organizationId,
    organizationName: organizationResult.error ? null : organizationResult.data?.name ?? null,
    rows: rowsResult.data.map((row) => ({
      ...row,
      project_count: usageCounts.get(row.id) ?? 0,
    })),
  }
}

export async function replaceSiteDepartmentsForSite(
  supabase: SupabaseClient,
  organizationId: string,
  originalSite: string | null,
  siteName: string,
  departments: string[]
) {
  const normalizedDepartments = departments.map((department) => department.trim()).filter(Boolean)
  const sourceSite = originalSite?.trim() || siteName
  const siteRenamed = !!originalSite && originalSite.trim() !== siteName

  if (!siteRenamed) {
    const existingResult = await supabase
      .from('site_departments')
      .select('id, organization_id, site, department, active, created_at')
      .eq('organization_id', organizationId)
      .eq('site', sourceSite)

    if (existingResult.error) {
      throw new Error(existingResult.error.message)
    }

    const existingRows = ((existingResult.data ?? []) as SiteDeptRow[])
    const existingByDepartment = new Map(existingRows.map((row) => [normalizeKey(row.department), row]))
    const requestedKeys = new Set(normalizedDepartments.map(normalizeKey))
    const payload = normalizedDepartments
      .filter((department) => !existingByDepartment.has(normalizeKey(department)))
      .map((department) => ({
        organization_id: organizationId,
        site: siteName,
        department,
        active: true,
      }))

    if (payload.length) {
      const insertResult = await supabase.from('site_departments').insert(payload)
      if (insertResult.error) {
        throw new Error(mapSiteDepartmentWriteError(insertResult.error))
      }
    }

    const rowsToDelete = existingRows.filter((row) => !requestedKeys.has(normalizeKey(row.department)))
    if (rowsToDelete.length) {
      const deleteResult = await supabase
        .from('site_departments')
        .delete()
        .in(
          'id',
          rowsToDelete.map((row) => row.id)
        )

      if (deleteResult.error) {
        throw new Error(mapSiteDepartmentWriteError(deleteResult.error))
      }
    }

    return payload
  }

  const oldRowsResult = await supabase
    .from('site_departments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('site', sourceSite)

  if (oldRowsResult.error) {
    throw new Error(oldRowsResult.error.message)
  }

  const oldIds = ((oldRowsResult.data ?? []) as Pick<SiteDeptRow, 'id'>[]).map((row) => row.id)
  if (oldIds.length) {
    const projectResult = await supabase.from('projects').select('id').in('site_department_id', oldIds).limit(1)
    if (projectResult.error) {
      throw new Error(projectResult.error.message)
    }
    if ((projectResult.data ?? []).length > 0) {
      throw new Error('This site is used by existing projects and cannot be renamed safely. Create a new site/department or reassign projects first.')
    }
  }

  if (sourceSite) {
    const deleteResult = await supabase
      .from('site_departments')
      .delete()
      .eq('organization_id', organizationId)
      .eq('site', sourceSite)

    if (deleteResult.error) {
      throw new Error(mapSiteDepartmentWriteError(deleteResult.error))
    }
  }

  const payload = normalizedDepartments.map((department) => ({
    organization_id: organizationId,
    site: siteName,
    department,
    active: true,
  }))

  const insertResult = await supabase.from('site_departments').insert(payload)
  if (insertResult.error) {
    throw new Error(mapSiteDepartmentWriteError(insertResult.error))
  }

  return payload
}

export async function deleteSiteDepartmentsForSite(
  supabase: SupabaseClient,
  organizationId: string,
  siteName: string
) {
  const result = await supabase
    .from('site_departments')
    .delete()
    .eq('organization_id', organizationId)
    .eq('site', siteName)

  if (result.error) {
    throw new Error(mapSiteDepartmentWriteError(result.error))
  }
}

export async function updateSiteDepartmentsActiveState(
  supabase: SupabaseClient,
  organizationId: string,
  siteName: string,
  active: boolean
) {
  const result = await supabase
    .from('site_departments')
    .update({ active })
    .eq('organization_id', organizationId)
    .eq('site', siteName)

  if (result.error) {
    throw new Error(result.error.message)
  }
}
