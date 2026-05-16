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
      if (request === './pfmea-continuation-utils') {
        return loadModule(['src', 'features', 'pfmea', 'pfmea-continuation-utils.ts'])
      }
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  getEmptyPfmeaTransientRowIds,
  getPfmeaTransientRowIds,
  getPfmeaTransientRowKind,
  isPfmeaTransientRowEmpty,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-transient-row-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const emptyRow = {
  id: 'row-empty-cause',
  cause: '',
  occurrence: null,
  current_prevention: '',
  current_detection: '',
  detection: null,
  recommended_action: '',
  responsible: '',
  target_date: null,
  action_status: '',
  occurrence2: null,
  detection2: null,
}

const filledCauseRow = {
  ...emptyRow,
  id: 'row-filled-cause',
  cause: 'Degassing step skipped',
}

const emptyActionRow = {
  ...emptyRow,
  id: 'row-empty-action',
  cause: 'Existing cause',
  occurrence: 4,
  detection: 5,
}

const pendingFilledActionRow = {
  ...emptyActionRow,
  id: 'row-pending-action',
}

const emptyEffectRow = {
  ...emptyRow,
  id: 'row-empty-effect',
  failure_mode: 'Voids',
  effect: '',
  severity: null,
}

const sets = {
  causeContinuationIds: new Set(['row-empty-cause', 'row-filled-cause']),
  recommendedActionContinuationIds: new Set(['row-empty-action', 'row-pending-action']),
  failureModeContinuationIds: new Set([]),
  effectContinuationIds: new Set(['row-empty-effect']),
}

assert.equal(getPfmeaTransientRowKind('row-empty-cause', sets), 'cause')
assert.equal(getPfmeaTransientRowKind('row-empty-action', sets), 'recommendedAction')
assert.equal(getPfmeaTransientRowKind('row-missing', sets), null)

assert.equal(isPfmeaTransientRowEmpty('row-empty-cause', emptyRow, sets), true)
assert.equal(isPfmeaTransientRowEmpty('row-filled-cause', filledCauseRow, sets), false)

assertJsonEqual([...getPfmeaTransientRowIds(sets)].sort(), [
  'row-empty-action',
  'row-empty-cause',
  'row-empty-effect',
  'row-filled-cause',
  'row-pending-action',
])

const rows = [emptyRow, filledCauseRow, emptyActionRow, pendingFilledActionRow, emptyEffectRow]
const emptyIds = getEmptyPfmeaTransientRowIds(rows, sets, (row) => {
  if (row.id === 'row-pending-action') return { ...row, recommended_action: 'Review controls' }
  return row
})

assertJsonEqual(emptyIds.sort(), ['row-empty-action', 'row-empty-cause', 'row-empty-effect'])

console.log('pfmea transient row utils smoke passed')
