const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const tableBodySource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-body.tsx'), 'utf8')
const actionClosureCellsSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-action-closure-cells.tsx'),
  'utf8'
)

assert.match(actionClosureCellsSource, /export function PfmeaActionClosureCells/, 'PFMEA action closure cells component must be exported.')
assert.match(actionClosureCellsSource, /import \{ TdText \}/, 'PFMEA action closure cells must reuse text cells.')
assert.match(actionClosureCellsSource, /import \{ TdDate \}/, 'PFMEA action closure cells must reuse date cells.')
assert.match(actionClosureCellsSource, /import \{ TdSelect \}/, 'PFMEA action closure cells must reuse status select cells.')
assert.match(actionClosureCellsSource, /const ACTION_STATUS_OPTIONS = \['', 'OPEN', 'CLOSED', 'CANCELED'\]/, 'PFMEA action status options must be preserved.')

for (const col of ['responsible', 'target_date', 'action_status']) {
  assert.match(actionClosureCellsSource, new RegExp(`isColumnVisible\\('${col}'\\)`), `PFMEA ${col} visibility gate must be preserved.`)
  assert.match(actionClosureCellsSource, new RegExp(`cellKey="${col}"`), `PFMEA ${col} cell key must be preserved.`)
}

assert.match(actionClosureCellsSource, /singleLine/, 'PFMEA responsible cell must stay single-line.')
assert.match(actionClosureCellsSource, /flash=\{isMissingHighlighted\('responsible'\)\}/, 'PFMEA responsible missing highlight must be preserved.')
assert.match(actionClosureCellsSource, /flash=\{isMissingHighlighted\('target_date'\)\}/, 'PFMEA target date missing highlight must be preserved.')
assert.match(actionClosureCellsSource, /flash=\{isMissingHighlighted\('action_status'\)\}/, 'PFMEA action status missing highlight must be preserved.')

assert.match(tableBodySource, /import \{ PfmeaActionClosureCells \}/, 'PFMEA table body must import PfmeaActionClosureCells.')
assert.match(tableBodySource, /<PfmeaActionClosureCells[\s\S]*effectiveCurrentRow=\{effectiveCurrentRow\}/, 'PFMEA table body must pass current action closure row values.')
assert.match(tableBodySource, /<PfmeaActionClosureCells[\s\S]*latestRowForHighlights=\{latestRowForHighlights\}/, 'PFMEA table body must pass highlighted status row.')
assert.match(tableBodySource, /<PfmeaActionClosureCells[\s\S]*onCommit=\{\(patch\) => props\.updateCellWithDerived\(r, patch\)\}/, 'PFMEA table body must preserve action closure commit path.')
assert.match(tableBodySource, /<PfmeaActionClosureCells[\s\S]*onStart=\{runActionPlanStart\}/, 'PFMEA table body must preserve action plan start validation.')

console.log('pfmea action closure cells smoke passed')
