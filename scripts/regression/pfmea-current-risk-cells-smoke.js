const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfmea', 'page.tsx'), 'utf8')
const currentRiskCellsSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-current-risk-cells.tsx'),
  'utf8'
)

assert.match(currentRiskCellsSource, /export function PfmeaCurrentRiskCells/, 'PFMEA current risk cells component must be exported.')
assert.match(currentRiskCellsSource, /import \{ TdRead \}/, 'PFMEA current risk cells must use the existing read-only merged cell.')
assert.match(currentRiskCellsSource, /import \{ TdPcpToggle \}/, 'PFMEA current risk cells must use the existing PCP toggle cell.')
assert.match(currentRiskCellsSource, /const expandOperation = \(\) => onExpandOperation\(operationId\)/, 'PFMEA current risk cells must preserve operation expand callback.')
assert.match(currentRiskCellsSource, /isColumnVisible\('rpn'\) && actionPlanBlockSpan > 0/, 'PFMEA current RPN cell must stay gated by RPN visibility and action plan owner span.')
assert.match(currentRiskCellsSource, /rowSpan=\{actionPlanBlockSpan\}/, 'PFMEA current RPN cell must preserve merged rowSpan.')
assert.match(currentRiskCellsSource, /className="pfmeaTd rpnCell center gray singleLine"/, 'PFMEA current RPN cell must preserve existing style.')
assert.match(currentRiskCellsSource, /isColumnVisible\('pcp'\)/, 'PFMEA PCP cell must stay gated by PCP visibility.')
assert.match(currentRiskCellsSource, /onToggle=\{onTogglePcp\}/, 'PFMEA PCP cell must delegate toggle behavior without changing it.')
assert.match(currentRiskCellsSource, /cellKey="pcp"/, 'PFMEA PCP cell must preserve data column key.')

assert.match(pageSource, /import \{ PfmeaCurrentRiskCells \}/, 'PFMEA page must import PfmeaCurrentRiskCells.')
assert.match(pageSource, /<PfmeaCurrentRiskCells[\s\S]*actionPlanBlockSpan=\{actionPlanBlockSpan\}[\s\S]*currentRpn=\{a1\.rpn\}/, 'PFMEA page must pass current RPN and span from the row model.')
assert.match(pageSource, /<PfmeaCurrentRiskCells[\s\S]*operationId=\{r\.operation_id \|\| r\.operations\?\.id \|\| null\}/, 'PFMEA page must preserve existing operation id for expand behavior.')
assert.match(pageSource, /<PfmeaCurrentRiskCells[\s\S]*void updateCellWithDerived\(r, \{ pcp: !pcpChecked \}\)/, 'PFMEA page must preserve existing PCP toggle update.')

console.log('pfmea current risk cells smoke passed')
