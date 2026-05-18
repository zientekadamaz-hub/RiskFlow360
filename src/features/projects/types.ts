export type ProjectRowDb = {
  id: string
  organization_id?: string | null
  name?: string | null
  products?: string | null
  product_names?: string | null
  site_department_id?: string | null
  status?: string | null
  open_revision_label?: string | null
  draft_revision_label?: string | null
  current_open_revision_id?: string | null
  current_draft_revision_id?: string | null
  created_at: string
  updated_at?: string | null
  updated_by?: string | null
  user_id?: string | null
}

export type UiProjectRow = {
  id: string
  currentRevisionId: string
  site: string
  department: string
  process: string
  products: string
  avgRpn: number | null
  riskCount: number
  updated: string
  revision: string
  status: string
}

export type ProjectPfmeaStat = {
  avgRpn: number | null
  riskCount: number
  revisionId: string
}

export type OpenRiskSummary = {
  riskCount: number
  openRiskAvgRpn: number | null
  riskColorCounts: Record<RiskColor, number>
}

export type PfdHistoryTooltipRow = {
  project_id?: string | null
  created_at?: string | null
  revision_label?: string | null
  change_description?: string | null
  author_name?: string | null
}

export type RevisionPopupRow = {
  module: 'PFD' | 'PFMEA' | 'PCP'
  revisionLabel: string
  at: string
  author: string
  description: string
  hasData: boolean
}

export type RevisionPopupData = {
  loading: boolean
  rows: RevisionPopupRow[]
  error?: boolean
}

export type UserCtx = {
  userId: string
  orgId: string | null
  globalRole: string | null
  orgRole: string | null
  canDelete: boolean
  isChampion: boolean
  isCustomer: boolean
  canManageProjects: boolean
}

export type HeaderRpcRow = {
  global_role?: string | null
  org_name?: string | null
  org_role?: string | null
}

export type Mode = 'manual' | 'rpn'
export type RiskColor = 'green' | 'yellow' | 'orange' | 'red'
export type RpnThresholds = { greenMax: number; yellowMax: number; orangeMax: number }

export type SiteDepartmentOption = {
  id: string
  site: string
  department: string
}
