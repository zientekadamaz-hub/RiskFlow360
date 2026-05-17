const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const tableBodySource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-body.tsx'), 'utf8')
const operationCellsSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-operation-cells.tsx'), 'utf8')

assert.match(operationCellsSource, /export function PfmeaOperationCells/, 'PFMEA operation cells component must be exported.')
assert.match(operationCellsSource, /if \(span <= 0\) return null/, 'PFMEA operation cells must not render for non-owner merged rows.')
assert.match(operationCellsSource, /const expandOperation = \(\) => onExpandOperation\(operationId\)/, 'PFMEA operation cells must preserve operation expand callback.')

for (const col of ['id', 'station', 'operation', 'process_step']) {
  assert.match(operationCellsSource, new RegExp(`isColumnVisible\\('${col}'\\)`), `PFMEA operation cells must preserve ${col} visibility gate.`)
}

const tdReadCount = (operationCellsSource.match(/<TdRead/g) ?? []).length
assert.equal(tdReadCount, 4, 'PFMEA operation cells must render four TdRead cells.')
assert.match(operationCellsSource, /rowSpan=\{span\}/, 'PFMEA operation cells must preserve merged rowSpan.')
assert.match(operationCellsSource, /className="pfmeaTd gray center multiLine"/, 'PFMEA operation cells must preserve centered operation cell style.')
assert.match(operationCellsSource, /className="pfmeaTd gray multiLine"/, 'PFMEA operation cells must preserve process step cell style.')

assert.match(tableBodySource, /import \{ PfmeaOperationCells \}/, 'PFMEA table body must import PfmeaOperationCells.')
assert.match(tableBodySource, /<PfmeaOperationCells[\s\S]*operationId=\{r\.operation_id \|\| r\.operations\?\.id \|\| null\}[\s\S]*span=\{span\}/, 'PFMEA table body must pass existing operation id and span into operation cells.')

console.log('pfmea operation cells smoke passed')
