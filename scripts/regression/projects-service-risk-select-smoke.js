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

const selectUses = source.match(/\.select\(PROJECTS_PFMEA_RISK_SELECT\)/g) ?? []
assert.equal(selectUses.length, 2, 'Both Projects PFMEA stats queries must use the shared risk select.')

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

assert.doesNotMatch(
  source,
  /const projectId = normalizeProjectText\(operation\?\.project_id\)/,
  'Projects table PFMEA stats must not depend on nested operation project ids for aggregation.'
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
    draft_revision_label: '1.2.0',
    open_revision_label: '1.1.0',
    created_at: '2026-05-18T00:00:00Z',
  }],
  { 'site-dept-1': { site: 'Krakow', department: 'Engineering' } },
  { 'project-1': { avgRpn: 144, revisionId: 'open-rev', riskCount: 3 } }
)
assert.equal(uiRow.currentRevisionId, 'open-rev', 'Projects UI row must use the stat revision so summary tiles query the same rows as the table.')
assert.equal(uiRow.riskCount, 3, 'Projects UI row must keep risk count from the selected stats revision.')

console.log('projects service risk select smoke passed')
