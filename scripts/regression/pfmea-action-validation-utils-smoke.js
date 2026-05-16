const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function loadModule(relativePath) {
  const sourcePath = path.join(__dirname, '..', '..', ...relativePath)
  const source = fs.readFileSync(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (request) => {
      if (request === './pfmea-risk-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  buildPfmeaActionPlanValidationRow,
  getMissingRequiredForRecommendedAction,
  getPfmeaActionPlanHighlightOwnerRow,
  getPfmeaMissingActionPlanHighlightKeys,
  getPreviousRequiredFieldForActionPlan,
  isPfmeaCellHighlighted,
  pfmeaCellHighlightKey,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-action-validation-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const complete = {
  failure_mode: 'Void',
  effect: 'Weak insulation',
  severity: 6,
  cause: 'Air trapped',
  occurrence: 3,
  current_prevention: 'Degassing',
  current_detection: 'Visual check',
  detection: 3,
  recommended_action: 'Improve fixture',
  responsible: 'Quality',
  target_date: '2026-05-10',
  action_status: 'Open',
  occurrence2: 2,
}

assertJsonEqual(getMissingRequiredForRecommendedAction({ ...complete, effect: '', detection: null }), ['effect', 'detection'])
assertJsonEqual(getPreviousRequiredFieldForActionPlan('recommended_action', complete), [])
assertJsonEqual(getPreviousRequiredFieldForActionPlan('responsible', { ...complete, recommended_action: '' }), ['recommended_action'])
assertJsonEqual(getPreviousRequiredFieldForActionPlan('detection2', { ...complete, occurrence2: null }), [
  'occurrence2',
  'action_status',
  'target_date',
  'responsible',
  'recommended_action',
])

const mergedContext = buildPfmeaActionPlanValidationRow({
  actionPlanOwnerRow: {
    cause: 'Second cause',
    current_detection: 'Final check',
    current_prevention: 'Standard work',
    detection: 8,
    occurrence: 8,
  },
  currentRow: {
    ...complete,
    cause: 'Second cause',
    current_detection: 'Final check',
    current_prevention: 'Standard work',
    detection: 8,
    effect: '',
    occurrence: 8,
    severity: null,
  },
  failureBlockOwnerRow: {
    effect: 'Merged effect from owner row',
    severity: 9,
  },
  failureModeOwnerRow: {
    failure_mode: 'Merged failure mode',
  },
})
assertJsonEqual(getPreviousRequiredFieldForActionPlan('recommended_action', mergedContext), [])

const ownerRows = {
  actionPlanOwnerRow: { id: 'action-row' },
  currentRow: { id: 'current-row' },
  failureBlockOwnerRow: { id: 'block-row' },
  failureModeOwnerRow: { id: 'mode-row' },
}
assert.equal(pfmeaCellHighlightKey('row-1', 'severity'), 'row-1::severity')
assert.equal(isPfmeaCellHighlighted(['row-1::severity'], 'row-1', 'severity'), true)
assert.equal(isPfmeaCellHighlighted(['row-1::severity'], 'row-1', 'effect'), false)
assert.equal(getPfmeaActionPlanHighlightOwnerRow('failure_mode', ownerRows).id, 'mode-row')
assert.equal(getPfmeaActionPlanHighlightOwnerRow('severity', ownerRows).id, 'block-row')
assert.equal(getPfmeaActionPlanHighlightOwnerRow('detection', ownerRows).id, 'action-row')
assert.equal(getPfmeaActionPlanHighlightOwnerRow('recommended_action', ownerRows).id, 'current-row')
assertJsonEqual(
  getPfmeaMissingActionPlanHighlightKeys(['failure_mode', 'severity', 'detection', 'recommended_action'], ownerRows),
  ['mode-row::failure_mode', 'block-row::severity', 'action-row::detection', 'current-row::recommended_action']
)

console.log('pfmea action validation utils smoke passed')
