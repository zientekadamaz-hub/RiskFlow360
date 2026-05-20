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
      if (request === './pfmea-row-factory-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-row-factory-utils.ts'])
      if (request === './pfmea-risk-uid-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-uid-utils.ts'])
      if (request === './pfmea-risk-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-utils.ts'])
      if (request === './pfmea-value-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-value-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  buildPfmeaCauseContinuationInsertPayload,
  buildPfmeaEffectContinuationInsertPayload,
  buildPfmeaFailureModeContinuationInsertPayload,
  buildPfmeaRecommendedActionContinuationInsertPayload,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-row-insert-payload-utils.ts'])

const finalRevisionId = 'rev-draft'
const createdAt = '2026-05-16T10:00:00.000Z'

const targetRow = {
  id: 'row-anchor',
  operation_id: 'op-1',
  revision_id: 'rev-open',
}

const sourceRow = {
  ...targetRow,
  failure_mode_group_id: 'fm-1',
  failure_block_group_id: 'fb-1',
  action_plan_group_id: 'ap-1',
  risk_uid: '11111111-1111-4111-8111-111111111111',
  failure_mode: 'Voids',
  effect: 'Reduced insulation strength',
  severity: '9',
  characteristic: 'Potting quality',
  class: '  special characteristic  ',
  cause: 'Degassing skipped',
  occurrence: '8',
  current_prevention: 'Standard work',
  current_detection: 'Lab check',
  detection: '9',
}

const failureModePayload = buildPfmeaFailureModeContinuationInsertPayload(targetRow, finalRevisionId, createdAt)
assert.equal(failureModePayload.operation_id, 'op-1')
assert.equal(failureModePayload.revision_id, finalRevisionId)
assert.equal(failureModePayload.created_at, createdAt)
assert.equal(failureModePayload.failure_mode, '')

const effectPayload = buildPfmeaEffectContinuationInsertPayload(targetRow, sourceRow, finalRevisionId, createdAt)
assert.equal(effectPayload.failure_mode, 'Voids')
assert.equal(effectPayload.characteristic, 'Potting quality')
assert.equal(effectPayload.class, 'SC')
assert.equal(effectPayload.failure_mode_group_id, 'fm-1')
assert.equal(effectPayload.created_at, createdAt)

const causePayload = buildPfmeaCauseContinuationInsertPayload(targetRow, sourceRow, finalRevisionId, createdAt)
assert.equal(causePayload.failure_mode, 'Voids')
assert.equal(causePayload.effect, 'Reduced insulation strength')
assert.equal(causePayload.severity, 9)
assert.equal(causePayload.failure_block_group_id, 'fb-1')
assert.equal(causePayload.created_at, createdAt)

const actionPayload = buildPfmeaRecommendedActionContinuationInsertPayload(targetRow, sourceRow, finalRevisionId, createdAt)
assert.equal(actionPayload.cause, 'Degassing skipped')
assert.equal(actionPayload.occurrence, 8)
assert.equal(actionPayload.detection, 9)
assert.equal(actionPayload.rpn, 648)
assert.equal(actionPayload.oxd, 72)
assert.equal(actionPayload.rpn_current, 648)
assert.equal(actionPayload.action_plan_group_id, 'ap-1')
assert.equal(actionPayload.risk_uid, sourceRow.risk_uid)
assert.equal(actionPayload.recommended_action, '')
assert.equal(actionPayload.created_at, createdAt)

console.log('pfmea row insert payload utils smoke passed')
