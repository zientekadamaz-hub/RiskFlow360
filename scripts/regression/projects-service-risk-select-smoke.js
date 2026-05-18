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
  /PROJECTS_PFMEA_RISK_SELECT = `\$\{PFMEA_REPORT_RISK_FIELDS\},operations!inner\(id,project_id,active\)`/,
  'Projects service must fetch the same PFMEA risk fields as Progress Chart and RPN Matrix.'
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

console.log('projects service risk select smoke passed')
