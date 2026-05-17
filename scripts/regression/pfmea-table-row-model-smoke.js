const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const tableBodySource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-body.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-row-model.ts'), 'utf8')

assert.match(modelSource, /export function buildPfmeaTableRowModel/, 'PFMEA table row model helper must be exported.')

const expectedModelMarkers = [
  'findPfmeaMergeOwnerRow',
  'effectiveFailureModeOwnerRow',
  'effectiveFailureBlockOwnerRow',
  'effectiveActionPlanOwnerRow',
  'getPfmeaPcpAutoReasons',
  'isPfmeaSelectedForPcp',
  'pcpSourceRow',
  'isPfmeaCellHighlighted',
  'colorFill',
  'groupStart',
  'currentRiskMuted',
  'residualRiskMuted',
  '!currentRiskMuted',
  'MUTED_RISK_TEXT_COLOR',
  'closedActionRows.length > 0',
  'closedResidualCandidates',
  'bestClosedResidualRowId',
  'effectiveCurrentRow.id !== bestClosedResidualRowId',
  'rowHierarchyById.get',
]

for (const marker of expectedModelMarkers) {
  assert.match(modelSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `PFMEA row model is missing marker: ${marker}`)
}

const modelCall = tableBodySource.indexOf('buildPfmeaTableRowModel')
const rowReturn = tableBodySource.indexOf('return (', modelCall)
assert.notEqual(modelCall, -1, 'PFMEA table body must call buildPfmeaTableRowModel.')
assert.ok(rowReturn > modelCall, 'PFMEA row model must be built before row JSX is returned.')
assert.match(tableBodySource, /const \{\s*[\s\S]*currentRisk: a1,[\s\S]*residualRisk: a2,[\s\S]*\} = buildPfmeaTableRowModel/, 'PFMEA table body must keep existing a1/a2 row aliases from the model.')
assert.match(tableBodySource, /sourceRows: props\.rowsRef\.current/, 'PFMEA row model must receive latest source rows for highlights.')
assert.match(tableBodySource, /tableRows: props\.tableRows,/, 'PFMEA row model must receive visible table rows for merge ownership.')

console.log('pfmea table row model smoke passed')
