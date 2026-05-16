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
      if (request === './pfmea-columns') return loadModule(['src', 'features', 'pfmea', 'pfmea-columns.ts'])
      if (request === './pfmea-hierarchy-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-hierarchy-utils.ts'])
      if (request === './pfmea-row-factory-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-row-factory-utils.ts'])
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
  buildPfmeaPendingEditablePatch,
  buildPfmeaPlaceholderInsertPayload,
  normalizePfmeaEditablePatch,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-cell-edit-utils.ts'])

const normalized = normalizePfmeaEditablePatch({
  severity: '9',
  occurrence: '12',
  detection: '4',
  occurrence2: '2',
  detection2: '3',
  pcp: 'yes',
  class: 'critical characteristic',
})

assert.equal(normalized.severity, 9)
assert.equal(normalized.occurrence, null)
assert.equal(normalized.detection, 4)
assert.equal(normalized.occurrence2, 2)
assert.equal(normalized.detection2, 3)
assert.equal(normalized.pcp, true)
assert.equal(normalized.class, 'CC')

const row = {
  id: '__pfmea_placeholder__:op-1',
  operation_id: 'op-1',
  revision_id: null,
  failure_mode_group_id: 'fm-1',
  failure_block_group_id: 'fb-1',
  action_plan_group_id: 'ap-1',
  failure_mode: 'Voids',
  effect: 'Reduced insulation strength',
  severity: '9',
  characteristic: 'Potting quality',
  class: 'SC',
  cause: 'Degassing skipped',
  occurrence: '8',
  current_prevention: 'Standard work',
  current_detection: 'Lab check',
  detection: '9',
  recommended_action: '',
  responsible: '',
  target_date: null,
  action_status: 'OPEN',
  occurrence2: null,
  detection2: null,
}

const pendingPatch = buildPfmeaPendingEditablePatch(row)
assert.equal(pendingPatch.severity, 9)
assert.equal(pendingPatch.occurrence, 8)
assert.equal(pendingPatch.detection, 9)
assert.equal(pendingPatch.class, 'SC')

const payload = buildPfmeaPlaceholderInsertPayload(row, 'rev-draft', pendingPatch)
assert.equal(payload.revision_id, 'rev-draft')
assert.equal(payload.operation_id, 'op-1')
assert.equal(payload.failure_mode_group_id, 'fm-1')
assert.equal(payload.failure_block_group_id, 'fb-1')
assert.equal(payload.action_plan_group_id, 'ap-1')
assert.equal(payload.rpn, 648)
assert.equal(payload.oxd, 72)
assert.equal(payload.rpn_current, 648)

console.log('pfmea cell edit utils smoke passed')
