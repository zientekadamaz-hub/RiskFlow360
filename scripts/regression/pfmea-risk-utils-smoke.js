const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'pfmea-risk-utils.ts')
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
  require,
}
sandbox.exports = sandbox.module.exports
vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })

const { asInt1to10, calcRpn, computeDerived } = sandbox.module.exports

function assertJsonEqual(actual, expected) {
  const normalize = (value) =>
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  assert.equal(JSON.stringify(normalize(actual)), JSON.stringify(normalize(expected)))
}

assert.equal(asInt1to10(' 7 '), 7)
assert.equal(asInt1to10(10.9), 10)
assert.equal(asInt1to10(0), null)
assert.equal(asInt1to10('x'), null)
assertJsonEqual(calcRpn('5', '3', '4'), { sev: 5, occ: 3, det: 4, doVal: 12, rpn: 60 })
assertJsonEqual(calcRpn('5', null, '4'), { sev: 5, occ: null, det: 4, doVal: null, rpn: null })
assertJsonEqual(
  computeDerived({
    action_status: 'OPEN',
    detection: 4,
    detection2: 2,
    occurrence: 3,
    occurrence2: 2,
    severity: 5,
  }),
  { oxd: 12, oxd2: 4, oxd_current: 12, rpn: 60, rpn2: 20, rpn_current: 60 }
)
assertJsonEqual(
  computeDerived({
    action_status: 'CLOSED',
    detection: 4,
    detection2: 2,
    occurrence: 3,
    occurrence2: 2,
    severity: 5,
  }),
  { oxd: 12, oxd2: 4, oxd_current: 4, rpn: 60, rpn2: 20, rpn_current: 20 }
)

console.log('pfmea risk utils smoke passed')
