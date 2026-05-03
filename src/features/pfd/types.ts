export type OperationRow = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine: string | null
  operation: string | null
  active: boolean
}

export type PfmeaMiniRow = {
  id: string
  operation_id: string
  failure_mode: string
  effect: string
  cause: string
  severity: number | null
  occurrence: number | null
  detection: number | null
  rpn: number | null
  oxd: number | null
  created_at: string
}

export type PfdHistoryEntry = {
  id: string
  at: string
  revision: number
  revisionLabel: string
  author: string
  description: string
  nodeCount: number
  edgeCount: number
}

export type PfdEditSession = {
  projectId: string
  lockedBy: string
  startedAt: string
  lastActivityAt: string
  lockedByName: string
}

export type ProjectProcessOptionRow = {
  name?: string | null
}

export type PfdUserContext = {
  currentUserId: string | null
  historyAuthor: string
}

export type PfdModuleAccessResult = {
  canOpenPfmeaPanel: boolean
  redirectToProjects: boolean
  state: 'checking' | 'allowed' | 'denied'
}

export type PersistedPfdDiagram = {
  nodes: unknown[]
  edges: unknown[]
}
