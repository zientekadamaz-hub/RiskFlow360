const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const tableBodySource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-body.tsx'), 'utf8')
const residualRiskCellsSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-residual-risk-cells.tsx'),
  'utf8'
)

assert.match(residualRiskCellsSource, /export function PfmeaResidualRiskCells/, 'PFMEA residual risk cells component must be exported.')
assert.match(residualRiskCellsSource, /import \{ TdScaleSelect \}/, 'PFMEA residual risk cells must reuse scale select cells.')
assert.match(residualRiskCellsSource, /import \{ TdRead \}/, 'PFMEA residual risk cells must reuse read-only RPN cell.')
assert.match(residualRiskCellsSource, /isColumnVisible\('o2'\)/, 'PFMEA residual OCC visibility gate must be preserved.')
assert.match(residualRiskCellsSource, /isColumnVisible\('d2'\)/, 'PFMEA residual DET visibility gate must be preserved.')
assert.match(residualRiskCellsSource, /isColumnVisible\('rpn2'\)/, 'PFMEA residual RPN visibility gate must be preserved.')
assert.match(residualRiskCellsSource, /cellKey="occurrence2"/, 'PFMEA residual OCC cell key must be preserved.')
assert.match(residualRiskCellsSource, /cellKey="detection2"/, 'PFMEA residual DET cell key must be preserved.')
assert.match(residualRiskCellsSource, /residualRiskMuted\?: boolean/, 'PFMEA residual cells must accept muted state for higher closed action RPN.')
assert.match(residualRiskCellsSource, /muted=\{residualRiskMuted\}/, 'PFMEA residual OCC/DET cells must mute when a higher closed action is superseded.')
assert.match(residualRiskCellsSource, /className="pfmeaTd rpnCell center gray singleLine"/, 'PFMEA residual RPN style must be preserved.')
assert.match(residualRiskCellsSource, /onClick=\{expandOperation\}/, 'PFMEA residual RPN expand behavior must be preserved.')

assert.match(tableBodySource, /import \{ PfmeaResidualRiskCells \}/, 'PFMEA table body must import PfmeaResidualRiskCells.')
assert.match(tableBodySource, /<PfmeaResidualRiskCells[\s\S]*residualRpn=\{a2\.rpn\}/, 'PFMEA table body must pass residual RPN from row model.')
assert.match(tableBodySource, /<PfmeaResidualRiskCells[\s\S]*riskRpn2Style=\{riskRpn2Style\}/, 'PFMEA table body must pass residual RPN color style.')
assert.match(tableBodySource, /<PfmeaResidualRiskCells[\s\S]*residualRiskMuted=\{residualRiskMuted\}/, 'PFMEA table body must pass muted state for higher closed action RPN.')
assert.match(tableBodySource, /<PfmeaResidualRiskCells[\s\S]*operationId=\{r\.operation_id \|\| r\.operations\?\.id \|\| null\}/, 'PFMEA table body must preserve operation id for residual RPN expand.')
assert.match(tableBodySource, /<PfmeaResidualRiskCells[\s\S]*onCommit=\{\(patch\) => props\.updateCellWithDerived\(r, patch\)\}/, 'PFMEA table body must preserve residual commit path.')

console.log('pfmea residual risk cells smoke passed')
