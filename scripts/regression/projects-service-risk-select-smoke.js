const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const source = fs.readFileSync(path.join(root, 'src', 'features', 'projects', 'projects-service.ts'), 'utf8')
const utilsSourcePath = path.join(root, 'src', 'features', 'projects', 'utils.ts')
const utilsSource = fs.readFileSync(utilsSourcePath, 'utf8')

assert.match(
  source,
  /import \{ PFMEA_REPORT_RISK_FIELDS \} from '@\/features\/reports\/pfmea-report-query'/,
  'Projects service must reuse the shared PFMEA report risk field list.'
)

assert.match(
  source,
  /PROJECTS_PFMEA_RISK_SELECT = `revision_id,\$\{PFMEA_REPORT_RISK_FIELDS\},operations!inner\(id,project_id,active\)`/,
  'Projects service must fetch the same PFMEA risk fields as Progress Chart and RPN Matrix, including revision_id for table aggregation.'
)

assert.match(
  source,
  /action_status\?: string \| null/,
  'Projects PFMEA stats row must include action_status for CLOSED residual risk calculation.'
)

assert.match(
  source,
  /occurrence2\?: number \| null/,
  'Projects PFMEA stats row must include occurrence2 for CLOSED residual risk calculation.'
)

assert.match(
  source,
  /detection2\?: number \| null/,
  'Projects PFMEA stats row must include detection2 for CLOSED residual risk calculation.'
)

assert.match(
  source,
  /rpn2\?: number \| null/,
  'Projects PFMEA stats row must include rpn2 so CLOSED actions can use stored RPN after.'
)

const selectUses = source.match(/\.select\(PROJECTS_PFMEA_RISK_SELECT\)/g) ?? []
assert.equal(selectUses.length, 3, 'Projects PFMEA stats and summary queries must use the shared risk select.')

assert.match(
  source,
  /const revisionIdsByProject: Record<string, string\[\]> = \{\}/,
  'Projects table PFMEA stats must keep all current project revision candidates.'
)

assert.match(
  source,
  /normalizeProjectText\(project\.current_draft_revision_id\)[\s\S]*normalizeProjectText\(project\.current_open_revision_id\)/,
  'Projects table PFMEA stats must query draft and open revisions in the same priority order as the displayed current revision.'
)

assert.match(
  source,
  /let selectedRevisionId = candidateRevisionIds\.find\(\(revisionId\) => byRevision\[revisionId\]\)/,
  'Projects table PFMEA stats must select the same revision candidate used for the displayed row and summary.'
)

assert.match(
  source,
  /revisionId: selectedRevisionId \?\? fallbackRevisionId/,
  'Projects table PFMEA stats must return the revision actually used so summary tiles query the same revision.'
)

assert.match(
  source,
  /\.in\('revision_id', revisionIds\)/,
  'Projects table PFMEA stats must query current project revisions directly.'
)

assert.match(
  source,
  /const projectIdsWithoutCandidateRows = projectIds\.filter/,
  'Projects table PFMEA stats must detect projects whose current revision fields do not point to PFMEA rows.'
)

assert.match(
  source,
  /\.in\('operations\.project_id', projectIdsWithoutCandidateRows\)/,
  'Projects table PFMEA stats must fall back to PFMEA rows by project when projects_with_revision is stale.'
)

assert.equal(
  (source.match(/\.eq\('operations\.active'/g) ?? []).length,
  0,
  'Projects PFMEA stats must not filter by operations.active because saved revision rows may be historical.'
)

assert.match(
  source,
  /projectByRevision\[revisionId\] \|\| getPfmeaStatsRowProjectId\(row\)/,
  'Projects table PFMEA stats must aggregate fallback PFMEA rows by their operation project id.'
)

function loadTypeScriptModule(sourcePath, moduleMap = {}) {
  const transpiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(moduleMap, request)) return moduleMap[request]
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const utils = loadTypeScriptModule(utilsSourcePath, {
  '@/lib/error-utils': { errorText: (error) => String(error?.message ?? error) },
  '@/lib/risk-engine': {
    clampRiskInt: (value, min, max) => Math.max(min, Math.min(max, Number(value) || min)),
    riskCellKey: (severity, doValue) => `${severity}|${doValue}`,
    riskColorForMatrixCell: () => null,
    riskColorFromRpn: () => 'green',
  },
})

assert.match(utilsSource, /export function getProjectCurrentRevisionId/, 'Projects utils must expose the shared current revision resolver.')
assert.equal(
  utils.getProjectCurrentRevisionId({ current_draft_revision_id: 'draft-rev', current_open_revision_id: 'open-rev' }),
  'draft-rev',
  'Projects current revision resolver must prefer draft over open.'
)

const [uiRow] = utils.mapProjectsToUiRows(
  [{
    id: 'project-1',
    name: 'Process',
    products: 'A',
    site_department_id: 'site-dept-1',
    status: 'OPEN',
    current_draft_revision_id: 'draft-rev',
    current_open_revision_id: 'open-rev',
    draft_revision_label: '1.1.5',
    open_revision_label: '1.1.4',
    created_at: '2026-05-18T00:00:00Z',
  }],
  { 'site-dept-1': { site: 'Krakow', department: 'Engineering' } },
  { 'project-1': { avgRpn: 144, revisionId: 'open-rev', riskCount: 3 } },
  { 'project-1': { pcp: true, pfd: false, pfmea: false } }
)
assert.equal(uiRow.currentRevisionId, 'open-rev', 'Projects UI row must use the stat revision so summary tiles query the same rows as the table.')
assert.equal(uiRow.riskCount, 3, 'Projects UI row must keep risk count from the selected stats revision.')
assert.equal(uiRow.revision, '1.1.4', 'Projects UI row must display the saved open revision label while a module is being edited.')
assert.equal(uiRow.editingModules.pcp, true, 'Projects UI row must keep active module edit state for revision highlighting.')

const projectsTableSource = fs.readFileSync(path.join(root, 'src', 'features', 'projects', 'ProjectsTable.tsx'), 'utf8')
const revisionPopoverSource = fs.readFileSync(path.join(root, 'src', 'features', 'projects', 'RevisionDetailsPopover.tsx'), 'utf8')
assert.match(projectsTableSource, /editingModules=\{project\.editingModules\}/, 'Projects table must pass active module edit state into the revision cell.')
assert.match(revisionPopoverSource, /const editingByRevisionPart = \[editingModules\.pfd, editingModules\.pfmea, editingModules\.pcp\]/, 'Revision cell must map revision segments to PFD, PFMEA and PCP edit sessions.')
assert.match(revisionPopoverSource, /color: '#f6b45f'/, 'Revision cell must use orange highlighting for an active module edit segment.')
assert.match(source, /fetchProjectRevisionEditingStates/, 'Projects service must expose active edit-session state for revision highlighting.')
assert.match(source, /pfd_edit_sessions[\s\S]*pfmea_edit_sessions[\s\S]*pcp_edit_sessions/, 'Projects service must read PFD, PFMEA and PCP edit sessions.')
assert.match(source, /PROJECTS_EDIT_SESSION_LOCK_MS = 48 \* 60 \* 60 \* 1000/, 'Projects edit-session highlighting must use the same 48h active-session window as modules.')

const projectsService = loadTypeScriptModule(path.join(root, 'src', 'features', 'projects', 'projects-service.ts'), {
  './utils': {
    cellKey: (severity, doValue) => `${severity}|${doValue}`,
    cleanProductList: (list) => list.map((value) => String(value).trim()).filter(Boolean),
    clampInt: (value, min, max) => Math.max(min, Math.min(max, Number(value) || min)),
    formatDateTimePL: (value) => value ?? '-',
    getProjectCurrentRevisionId: (project) => (project.current_draft_revision_id ?? '').trim() || (project.current_open_revision_id ?? '').trim(),
    getRiskColorFor: () => null,
    normalizeProjectText: (value) => (value ?? '').toString().trim(),
    sectionRevisionFromLabel: (value) => value ?? '-',
  },
  '@/features/reports/pfmea-report-query': {
    PFMEA_REPORT_RISK_FIELDS: 'id,operation_id,created_at,action_status,severity,occurrence,detection,occurrence2,detection2,oxd2,rpn2,oxd_current,rpn_current,rpn',
  },
  '@/features/reports/pfmea-report-risk-utils': {
    collectPfmeaCurrentOpenRisks: (rows) => rows.map((row, index) => ({
      doValue: row.oxd_current ?? null,
      key: `${row.revision_id}:${row.operation_id}:${row.id ?? index}`,
      row,
      rpn: row.rpn_current ?? row.rpn ?? null,
      severity: row.severity ?? null,
    })),
  },
})

function createProjectsStatsSupabaseMock() {
  const calls = []
  class Query {
    constructor() {
      this.result = []
    }

    select(value) {
      calls.push(['select', value])
      return this
    }

    in(field, values) {
      calls.push(['in', field, values])
      if (field === 'revision_id') {
        this.result = []
      } else if (field === 'operations.project_id') {
        this.result = [
          { id: 'risk-1', operation_id: 'op-1', revision_id: 'rev-8', created_at: '2026-05-19T10:00:00Z', rpn_current: 900, operations: { project_id: 'sensor' } },
          { id: 'risk-2', operation_id: 'op-1', revision_id: 'rev-8', created_at: '2026-05-19T10:01:00Z', rpn_current: 800, operations: { project_id: 'sensor' } },
          { id: 'risk-3', operation_id: 'op-2', revision_id: 'rev-8', created_at: '2026-05-19T10:02:00Z', rpn_current: 700, operations: { project_id: 'sensor' } },
          { id: 'risk-4', operation_id: 'op-2', revision_id: 'rev-8', created_at: '2026-05-19T10:03:00Z', rpn_current: 600, operations: { project_id: 'sensor' } },
        ]
      }
      return this
    }

    order(field, options) {
      calls.push(['order', field, options])
      return this
    }

    then(resolve) {
      resolve({ data: this.result, error: null })
    }
  }

  return {
    calls,
    from(table) {
      calls.push(['from', table])
      return new Query()
    },
  }
}

;(async () => {
  const supabaseMock = createProjectsStatsSupabaseMock()
  const stats = await projectsService.fetchProjectPfmeaStats(supabaseMock, [{
    id: 'sensor',
    current_draft_revision_id: 'stale-draft',
    current_open_revision_id: 'stale-open',
    created_at: '2026-05-19T00:00:00Z',
  }])

  assert.equal(stats.sensor.riskCount, 4, 'Projects stats must count PFMEA fallback rows when current revision fields are stale.')
  assert.equal(stats.sensor.avgRpn, 750, 'Projects stats must average PFMEA fallback rows for the revision shown by PFMEA.')
  assert.equal(stats.sensor.revisionId, 'rev-8', 'Projects stats must return the fallback revision id so summary tiles query the same rows.')
  assert.ok(
    supabaseMock.calls.some((call) => call[0] === 'in' && call[1] === 'operations.project_id' && call[2].includes('sensor')),
    'Projects stats must query PFMEA rows by operation project id for missing candidate revisions.'
  )

  console.log('projects service risk select smoke passed')
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
