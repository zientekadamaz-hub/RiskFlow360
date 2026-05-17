const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfmea', 'page.tsx'), 'utf8')
const bodySource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-body.tsx'), 'utf8')

assert.match(bodySource, /export function PfmeaTableBody/, 'PFMEA table body component must be exported.')
assert.match(bodySource, /<tbody>/, 'PFMEA table body must own tbody rendering.')
assert.match(bodySource, /props\.tableRows\.map/, 'PFMEA table body must render PFMEA rows from tableRows.')
assert.match(bodySource, /buildPfmeaTableRowModel/, 'PFMEA table body must keep row model construction in one place.')
assert.match(bodySource, /resolvePfmeaBlockEndAnchorRow/, 'PFMEA table body must preserve block-end anchoring for plus actions.')
assert.match(bodySource, /getPfmeaFailureBlockSourceRowAtIndex/, 'PFMEA table body must preserve failure-block source lookup for cause rows.')
assert.match(bodySource, /getPfmeaRecommendedActionContinuationSourceRow/, 'PFMEA table body must preserve action-plan validation context.')

const protectedCallbacks = [
  'addFailureModeContinuationRow',
  'addEffectContinuationRow',
  'addCauseContinuationRow',
  'addRecommendedActionContinuationRow',
  'materializePlaceholderRowForAdd',
  'updateCellWithDerived',
  'clearRecommendedActionTransientIfFilled',
  'setPendingCellValue',
]

for (const callback of protectedCallbacks) {
  assert.match(bodySource, new RegExp(`props\\.${callback}`), `PFMEA table body must preserve ${callback}.`)
  assert.match(pageSource, new RegExp(`${callback}=\\{${callback}\\}`), `PFMEA page must pass ${callback} into PfmeaTableBody.`)
}

assert.match(pageSource, /import \{ PfmeaTableBody \}/, 'PFMEA page must import PfmeaTableBody.')
assert.match(pageSource, /<PfmeaTableBody[\s\S]*tableRows=\{tableRows\}[\s\S]*updateCellWithDerived=\{updateCellWithDerived\}/,
  'PFMEA page must render PfmeaTableBody with row data and edit callbacks.')
assert.doesNotMatch(pageSource, /<tbody>/, 'PFMEA page should not own PFMEA table body markup after extraction.')
assert.doesNotMatch(pageSource, /buildPfmeaTableRowModel/, 'PFMEA page should not build table row models after body extraction.')

console.log('pfmea table body smoke passed')
