const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const tableBodySource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-body.tsx'), 'utf8')
const failureModeCellsSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-failure-mode-cells.tsx'),
  'utf8'
)
const classSelectCellSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-class-select-cell.tsx'),
  'utf8'
)

assert.match(failureModeCellsSource, /export function PfmeaFailureModeCells/, 'PFMEA failure mode cells component must be exported.')
assert.match(failureModeCellsSource, /if \(failureModeSpan <= 0\) return null/, 'PFMEA failure mode cells must not render non-owner merged rows.')
assert.match(failureModeCellsSource, /import \{ CLASS_OPTIONS, TdClassSelect \}/, 'PFMEA failure mode cells must reuse class selector.')
assert.match(failureModeCellsSource, /import \{ TdText \}/, 'PFMEA failure mode cells must reuse text cells.')

for (const col of ['failure_mode', 'characteristic', 'class']) {
  assert.match(failureModeCellsSource, new RegExp(`isColumnVisible\\('${col}'\\)`), `PFMEA ${col} visibility gate must be preserved.`)
  assert.match(failureModeCellsSource, new RegExp(`cellKey="${col}"`), `PFMEA ${col} cell key must be preserved.`)
}

assert.match(failureModeCellsSource, /rowSpan=\{failureModeSpan\}/, 'PFMEA failure mode cells must preserve merged rowSpan.')
assert.match(failureModeCellsSource, /sideAction=\{failureModeSideAction\}/, 'PFMEA failure mode plus action must be injected unchanged from the page.')
assert.match(failureModeCellsSource, /flash=\{isMissingHighlighted\('failure_mode'\)\}/, 'PFMEA failure mode missing highlight must be preserved.')
assert.match(failureModeCellsSource, /normalizeClassValue\(effectiveFailureModeOwnerRow\.class\)/, 'PFMEA class normalization must be preserved.')
assert.match(classSelectCellSource, /\(clear\)/, 'PFMEA class selector must allow clearing SC/CC.')
assert.match(classSelectCellSource, /selectedDetailsPopup/, 'PFMEA class selector must show descriptions in non-edit mode.')
assert.match(classSelectCellSource, /onMouseEnter=\{startValueHoverDelay\}/, 'PFMEA class selector must open description popup on hover.')

assert.match(tableBodySource, /import \{ PfmeaFailureModeCells \}/, 'PFMEA table body must import PfmeaFailureModeCells.')
assert.match(tableBodySource, /<PfmeaFailureModeCells[\s\S]*effectiveFailureModeOwnerRow=\{effectiveFailureModeOwnerRow\}/, 'PFMEA table body must pass failure mode owner row.')
assert.match(tableBodySource, /<PfmeaFailureModeCells[\s\S]*failureModeSpan=\{failureModeSpan\}/, 'PFMEA table body must pass failure mode span.')
assert.match(tableBodySource, /<PfmeaFailureModeCells[\s\S]*failureModeSideAction=\{[\s\S]*Add failure mode row/, 'PFMEA table body must preserve failure mode side action.')
assert.match(tableBodySource, /<PfmeaFailureModeCells[\s\S]*addFailureModeContinuationRow/, 'PFMEA table body must preserve failure mode continuation callback.')

console.log('pfmea failure mode cells smoke passed')
