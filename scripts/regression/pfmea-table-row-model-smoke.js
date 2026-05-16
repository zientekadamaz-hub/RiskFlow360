const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfmea', 'page.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-row-model.ts'), 'utf8')

assert.match(modelSource, /export function buildPfmeaTableRowModel/, 'PFMEA table row model helper must be exported.')

const expectedModelMarkers = [
  'findPfmeaMergeOwnerRow',
  'effectiveFailureModeOwnerRow',
  'effectiveFailureBlockOwnerRow',
  'effectiveActionPlanOwnerRow',
  'getPfmeaPcpAutoReasons',
  'isPfmeaSelectedForPcp',
  'isPfmeaCellHighlighted',
  'colorFill',
  'groupStart',
  'rowHierarchyById.get',
]

for (const marker of expectedModelMarkers) {
  assert.match(modelSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `PFMEA row model is missing marker: ${marker}`)
}

const modelCall = pageSource.indexOf('buildPfmeaTableRowModel')
const rowReturn = pageSource.indexOf('return (', modelCall)
assert.notEqual(modelCall, -1, 'PFMEA page must call buildPfmeaTableRowModel.')
assert.ok(rowReturn > modelCall, 'PFMEA row model must be built before row JSX is returned.')
assert.match(pageSource, /const \{\s*[\s\S]*currentRisk: a1,[\s\S]*residualRisk: a2,[\s\S]*\} = buildPfmeaTableRowModel/, 'PFMEA page must keep existing a1/a2 row aliases from the model.')
assert.match(pageSource, /sourceRows: rowsRef\.current/, 'PFMEA row model must receive latest source rows for highlights.')
assert.match(pageSource, /tableRows,/, 'PFMEA row model must receive visible table rows for merge ownership.')

console.log('pfmea table row model smoke passed')
