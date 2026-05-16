const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfmea', 'page.tsx'), 'utf8')
const causeCurrentControlCellsSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-cause-current-control-cells.tsx'),
  'utf8'
)

assert.match(causeCurrentControlCellsSource, /export function PfmeaCauseCurrentControlCells/, 'PFMEA cause/current control cells component must be exported.')
assert.match(causeCurrentControlCellsSource, /if \(actionPlanBlockSpan <= 0\) return null/, 'PFMEA cause/current control cells must not render non-owner merged rows.')
assert.match(causeCurrentControlCellsSource, /import \{ TdText \}/, 'PFMEA cause/current control cells must reuse text cells.')
assert.match(causeCurrentControlCellsSource, /import \{ TdScaleSelect \}/, 'PFMEA cause/current control cells must reuse scale select cells.')

const visibilityColumns = ['cause', 'occ', 'current_prev', 'current_det', 'det']
for (const col of visibilityColumns) {
  assert.match(causeCurrentControlCellsSource, new RegExp(`isColumnVisible\\('${col}'\\)`), `PFMEA ${col} visibility gate must be preserved.`)
}

const cellKeys = ['cause', 'occurrence', 'current_prevention', 'current_detection', 'detection']
for (const key of cellKeys) {
  assert.match(causeCurrentControlCellsSource, new RegExp(`cellKey="${key}"`), `PFMEA ${key} cell key must be preserved.`)
  assert.match(causeCurrentControlCellsSource, new RegExp(`flash=\\{isMissingHighlighted\\('${key}'\\)\\}`), `PFMEA ${key} missing highlight must be preserved.`)
}

assert.match(causeCurrentControlCellsSource, /rowSpan=\{actionPlanBlockSpan\}/, 'PFMEA cause/current control cells must preserve action plan rowSpan.')
assert.match(causeCurrentControlCellsSource, /sideAction=\{causeSideAction\}/, 'PFMEA cause plus action must be injected unchanged from the page.')

assert.match(pageSource, /import \{ PfmeaCauseCurrentControlCells \}/, 'PFMEA page must import PfmeaCauseCurrentControlCells.')
assert.match(pageSource, /<PfmeaCauseCurrentControlCells[\s\S]*effectiveActionPlanOwnerRow=\{effectiveActionPlanOwnerRow\}/, 'PFMEA page must pass action plan owner row.')
assert.match(pageSource, /<PfmeaCauseCurrentControlCells[\s\S]*actionPlanBlockSpan=\{actionPlanBlockSpan\}/, 'PFMEA page must pass action plan block span.')
assert.match(pageSource, /<PfmeaCauseCurrentControlCells[\s\S]*causeSideAction=\{[\s\S]*Add cause row/, 'PFMEA page must preserve cause side action.')
assert.match(pageSource, /<PfmeaCauseCurrentControlCells[\s\S]*addCauseContinuationRow/, 'PFMEA page must preserve cause continuation callback.')
assert.match(pageSource, /<PfmeaCauseCurrentControlCells[\s\S]*getFailureBlockSourceRowAtIndex/, 'PFMEA page must preserve cause source row lookup.')

console.log('pfmea cause current control cells smoke passed')
