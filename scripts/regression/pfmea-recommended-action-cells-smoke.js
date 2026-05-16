const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfmea', 'page.tsx'), 'utf8')
const recommendedActionCellsSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'pfmea-recommended-action-cells.tsx'),
  'utf8'
)

assert.match(recommendedActionCellsSource, /export function PfmeaRecommendedActionCells/, 'PFMEA recommended action cells component must be exported.')
assert.match(recommendedActionCellsSource, /if \(!isColumnVisible\('recommended_action'\)\) return null/, 'PFMEA recommended action visibility gate must be preserved.')
assert.match(recommendedActionCellsSource, /import \{ TdText \}/, 'PFMEA recommended action cells must reuse text cells.')
assert.match(recommendedActionCellsSource, /sideAction=\{recommendedActionSideAction\}/, 'PFMEA recommended action plus action must be injected unchanged from the page.')
assert.match(recommendedActionCellsSource, /flash=\{isMissingHighlighted\('recommended_action'\)\}/, 'PFMEA recommended action missing highlight must be preserved.')
assert.match(recommendedActionCellsSource, /cellKey="recommended_action"/, 'PFMEA recommended action cell key must be preserved.')
assert.match(recommendedActionCellsSource, /onCellKeyDown\(event, 'recommended_action', true\)/, 'PFMEA recommended action keyboard navigation must preserve multiline behavior.')

assert.match(pageSource, /import \{ PfmeaRecommendedActionCells \}/, 'PFMEA page must import PfmeaRecommendedActionCells.')
assert.match(pageSource, /<PfmeaRecommendedActionCells[\s\S]*effectiveCurrentRow=\{effectiveCurrentRow\}/, 'PFMEA page must pass recommended action row.')
assert.match(pageSource, /<PfmeaRecommendedActionCells[\s\S]*onStart=\{\(\) => runActionPlanStart\('recommended_action'\)\}/, 'PFMEA page must preserve action plan start validation.')
assert.match(pageSource, /<PfmeaRecommendedActionCells[\s\S]*clearRecommendedActionTransientIfFilled/, 'PFMEA page must preserve transient recommended action cleanup.')
assert.match(pageSource, /<PfmeaRecommendedActionCells[\s\S]*recommendedActionSideAction=\{[\s\S]*Add recommended action row/, 'PFMEA page must preserve recommended action side action.')
assert.match(pageSource, /<PfmeaRecommendedActionCells[\s\S]*addRecommendedActionContinuationRow/, 'PFMEA page must preserve recommended action continuation callback.')

console.log('pfmea recommended action cells smoke passed')
