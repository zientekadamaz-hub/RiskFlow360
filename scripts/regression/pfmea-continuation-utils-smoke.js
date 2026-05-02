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

  const sandbox = { exports: {}, module: { exports: {} }, require }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  hasFailureModeContext,
  hasPfmeaTextValue,
  isCauseContinuationEmpty,
  isEffectContinuationEmpty,
  isFailureModeContinuationEmpty,
  isRecommendedActionContinuationEmpty,
  patchHasAnyValue,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-continuation-utils.ts'])

const empty = {
  failure_mode: '',
  effect: '',
  severity: null,
  characteristic: '',
  class: null,
  cause: '',
  occurrence: null,
  current_prevention: '',
  current_detection: '',
  detection: null,
  recommended_action: '',
  responsible: '',
  target_date: null,
  action_status: null,
  occurrence2: null,
  detection2: null,
}

assert.equal(patchHasAnyValue({ a: null, b: '  ' }), false)
assert.equal(patchHasAnyValue({ a: 0 }), true)
assert.equal(hasPfmeaTextValue('  value  '), true)
assert.equal(hasPfmeaTextValue('  '), false)
assert.equal(hasFailureModeContext({ failure_mode: 'Void' }), true)
assert.equal(isCauseContinuationEmpty(empty), true)
assert.equal(isRecommendedActionContinuationEmpty({ ...empty, responsible: 'Owner' }), false)
assert.equal(isFailureModeContinuationEmpty({ ...empty, failure_mode: 'Void' }), false)
assert.equal(isEffectContinuationEmpty({ ...empty, effect: 'Weak insulation' }), false)

console.log('pfmea continuation utils smoke passed')
