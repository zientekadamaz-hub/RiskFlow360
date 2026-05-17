const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfmea', 'page.tsx'), 'utf8')
const controllerSource = fs.readFileSync(
  path.join(root, 'src', 'features', 'pfmea', 'use-pfmea-row-editing-controller.ts'),
  'utf8'
)

assert.match(controllerSource, /export function usePfmeaRowEditingController/, 'PFMEA row editing controller hook must be exported.')

const returnedActions = [
  'addCauseContinuationRow',
  'addEffectContinuationRow',
  'addFailureModeContinuationRow',
  'addRecommendedActionContinuationRow',
  'cleanupEmptyTransientRows',
  'deleteRow',
  'materializePlaceholderRowForAdd',
  'startEditCell',
  'updateCellWithDerived',
]

for (const action of returnedActions) {
  assert.match(controllerSource, new RegExp(action), `PFMEA row editing controller must include ${action}.`)
  assert.match(pageSource, new RegExp(action), `PFMEA page must receive/use ${action} from the controller.`)
}

const controllerMarkers = [
  'resolveContinuationRowsForRevision',
  'insertPfmeaRowAfterAnchorWithOrderMetadata',
  'buildPfmeaCauseContinuationInsertPayload',
  'buildPfmeaFailureModeContinuationInsertPayload',
  'buildPfmeaEffectContinuationInsertPayload',
  'buildPfmeaRecommendedActionContinuationInsertPayload',
  'runPendingCellUpdate',
  'setConfirmDialog',
  'removePfmeaTransientIdsFromSets',
]

for (const marker of controllerMarkers) {
  assert.match(controllerSource, new RegExp(marker), `PFMEA row editing controller is missing marker: ${marker}.`)
}

const pageForbidden = [
  /async function updateCellWithDerived/,
  /async function addCauseContinuationRow/,
  /async function addFailureModeContinuationRow/,
  /async function addEffectContinuationRow/,
  /async function addRecommendedActionContinuationRow/,
  /async function deleteRow/,
  /const ensureRowForEditing = useCallback/,
  /const materializePlaceholderRowForAdd = useCallback/,
]

for (const pattern of pageForbidden) {
  assert.doesNotMatch(pageSource, pattern, `PFMEA page should not contain moved row editing implementation: ${pattern}.`)
}

assert.match(pageSource, /usePfmeaRowEditingController\(\{[\s\S]*tableRows,[\s\S]*workingRevisionId,/,
  'PFMEA page must pass table rows and working revision into row editing controller.')

console.log('pfmea row editing controller smoke passed')
