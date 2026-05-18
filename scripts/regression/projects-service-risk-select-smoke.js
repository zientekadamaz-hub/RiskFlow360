const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const source = fs.readFileSync(path.join(root, 'src', 'features', 'projects', 'projects-service.ts'), 'utf8')

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
  /const projectByRevision: Record<string, string> = \{\}/,
  'Projects table PFMEA stats must map rows back to projects through current revision ids.'
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

console.log('projects service risk select smoke passed')
