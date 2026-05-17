const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const tableBodySource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-body.tsx'), 'utf8')
const failureEffectCellsSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-failure-effect-cells.tsx'),
  'utf8'
)

assert.match(failureEffectCellsSource, /export function PfmeaFailureEffectCells/, 'PFMEA failure effect cells component must be exported.')
assert.match(failureEffectCellsSource, /if \(failureBlockSpan <= 0\) return null/, 'PFMEA failure effect cells must not render non-owner merged rows.')
assert.match(failureEffectCellsSource, /import \{ TdText \}/, 'PFMEA failure effect cells must reuse text cells.')
assert.match(failureEffectCellsSource, /import \{ TdScaleSelect \}/, 'PFMEA failure effect cells must reuse scale select cells.')
assert.match(failureEffectCellsSource, /isColumnVisible\('effect'\)/, 'PFMEA effect visibility gate must be preserved.')
assert.match(failureEffectCellsSource, /isColumnVisible\('sev'\)/, 'PFMEA severity visibility gate must be preserved.')
assert.match(failureEffectCellsSource, /rowSpan=\{failureBlockSpan\}/, 'PFMEA effect/severity rowSpan must be preserved.')
assert.match(failureEffectCellsSource, /sideAction=\{effectSideAction\}/, 'PFMEA effect plus action must be injected unchanged from the page.')
assert.match(failureEffectCellsSource, /cellKey="effect"/, 'PFMEA effect cell key must be preserved.')
assert.match(failureEffectCellsSource, /cellKey="severity"/, 'PFMEA severity cell key must be preserved.')
assert.match(failureEffectCellsSource, /flash=\{isMissingHighlighted\('effect'\)\}/, 'PFMEA effect missing highlight must be preserved.')
assert.match(failureEffectCellsSource, /flash=\{isMissingHighlighted\('severity'\)\}/, 'PFMEA severity missing highlight must be preserved.')

assert.match(tableBodySource, /import \{ PfmeaFailureEffectCells \}/, 'PFMEA table body must import PfmeaFailureEffectCells.')
assert.match(tableBodySource, /<PfmeaFailureEffectCells[\s\S]*effectiveFailureBlockOwnerRow=\{effectiveFailureBlockOwnerRow\}/, 'PFMEA table body must pass failure block owner row.')
assert.match(tableBodySource, /<PfmeaFailureEffectCells[\s\S]*failureBlockSpan=\{failureBlockSpan\}/, 'PFMEA table body must pass failure block span.')
assert.match(tableBodySource, /<PfmeaFailureEffectCells[\s\S]*effectSideAction=\{[\s\S]*Add effect row/, 'PFMEA table body must preserve effect side action.')
assert.match(tableBodySource, /<PfmeaFailureEffectCells[\s\S]*addEffectContinuationRow/, 'PFMEA table body must preserve effect continuation callback.')
assert.match(tableBodySource, /<PfmeaFailureEffectCells[\s\S]*severityRowId=\{failureBlockOwnerRow\.id\}/, 'PFMEA table body must keep severity editing anchored to failure block owner.')

console.log('pfmea failure effect cells smoke passed')
