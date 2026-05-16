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
      if (request === './pfmea-hierarchy-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-hierarchy-utils.ts'])
      if (request === './pfmea-risk-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  computePfmeaDerivedFromContext,
  getPfmeaCauseContinuationSourceRow,
  getPfmeaFailureBlockSourceRowAtIndex,
  getPfmeaRecommendedActionContinuationSourceRow,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-row-context-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const completeRiskRow = {
  id: 'row-1',
  revision_id: 'rev-1',
  operation_id: 'op-1',
  row_no: '10.1.1.1.1',
  failure_mode_group_id: 'fm-1',
  failure_block_group_id: 'fb-1',
  action_plan_group_id: 'ap-1',
  failure_mode: 'Voids',
  effect: 'Reduced insulation strength',
  severity: 9,
  characteristic: '',
  class: null,
  pcp: null,
  cause: 'Degassing skipped',
  occurrence: 8,
  current_prevention: 'Standard work',
  current_detection: 'Lab check',
  detection: 9,
  recommended_action: 'Improve work instruction',
  responsible: '',
  target_date: null,
  action_status: 'OPEN',
  occurrence2: null,
  detection2: null,
  rpn: null,
  oxd: null,
  rpn2: null,
  oxd2: null,
  rpn_current: null,
  oxd_current: null,
  created_at: '2026-05-16T10:00:00.000Z',
  operations: { id: 'op-1', operation_number: 10, name: 'Step', machine: '', operation: '', project_id: 'project-1' },
}

const secondCauseRow = {
  ...completeRiskRow,
  id: 'row-2',
  row_no: '10.1.1.2.1',
  action_plan_group_id: 'ap-2',
  effect: '',
  severity: null,
  cause: 'Second cause',
  occurrence: 8,
  current_prevention: 'Fixture check',
  current_detection: 'Final review',
  detection: 8,
  recommended_action: 'Action for second cause',
  responsible: 'Owner',
  action_status: 'CLOSED',
  occurrence2: 2,
  detection2: 3,
  created_at: '2026-05-16T10:00:01.000Z',
}

const secondActionRow = {
  ...completeRiskRow,
  id: 'row-2a',
  row_no: '10.1.1.1.2',
  effect: '',
  severity: null,
  cause: '',
  occurrence: null,
  current_prevention: '',
  current_detection: '',
  detection: null,
  recommended_action: 'Action for same cause',
  responsible: 'Owner',
  action_status: 'CLOSED',
  occurrence2: 2,
  detection2: 3,
  created_at: '2026-05-16T10:00:01.500Z',
}

const otherBlockRow = {
  ...completeRiskRow,
  id: 'row-3',
  row_no: '10.1.2.1.1',
  failure_block_group_id: 'fb-2',
  action_plan_group_id: 'ap-3',
  effect: 'Other effect',
  severity: 5,
  cause: 'Other cause',
  occurrence: 3,
  detection: 4,
  created_at: '2026-05-16T10:00:02.000Z',
}

const rows = [completeRiskRow, secondActionRow, secondCauseRow, otherBlockRow]
const applyPending = (row) => row

const causeSource = getPfmeaCauseContinuationSourceRow(secondCauseRow, rows, applyPending)
assert.equal(causeSource.effect, 'Reduced insulation strength')
assert.equal(causeSource.severity, 9)
assert.equal(causeSource.cause, 'Second cause')
assert.equal(causeSource.detection, 8)

const actionSource = getPfmeaRecommendedActionContinuationSourceRow(secondActionRow, rows, applyPending)
assert.equal(actionSource.effect, 'Reduced insulation strength')
assert.equal(actionSource.severity, 9)
assert.equal(actionSource.cause, 'Degassing skipped')
assert.equal(actionSource.recommended_action, 'Action for same cause')

const derived = computePfmeaDerivedFromContext(secondCauseRow, rows, applyPending)
assert.equal(derived.currentRisk.rpn, 576)
assert.equal(derived.residualRisk.rpn, 54)
assertJsonEqual(derived.derived, {
  rpn: 576,
  oxd: 64,
  rpn2: 54,
  oxd2: 6,
  rpn_current: 54,
  oxd_current: 6,
})

const failureBlockSource = getPfmeaFailureBlockSourceRowAtIndex(2, rows, applyPending)
assert.equal(failureBlockSource.id, 'row-1')

console.log('pfmea row context utils smoke passed')
