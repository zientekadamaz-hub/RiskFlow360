const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', '..', 'src', 'lib', 'risk-engine.ts')
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

const {
  DEFAULT_RPN_THRESHOLDS,
  normalizeRpnThresholds,
  riskCellKey,
  riskColorForMatrixCell,
  riskColorFromRpn,
  riskColorFromRpnValue,
} = sandbox.module.exports

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

assert.deepEqual(plain(DEFAULT_RPN_THRESHOLDS), { greenMax: 100, orangeMax: 360, yellowMax: 200 })
assert.equal(riskCellKey(6, 9), '6|9')

assert.equal(riskColorFromRpnValue(100, DEFAULT_RPN_THRESHOLDS), 'green')
assert.equal(riskColorFromRpnValue(101, DEFAULT_RPN_THRESHOLDS), 'yellow')
assert.equal(riskColorFromRpnValue(201, DEFAULT_RPN_THRESHOLDS), 'orange')
assert.equal(riskColorFromRpnValue(361, DEFAULT_RPN_THRESHOLDS), 'red')
assert.equal(riskColorFromRpn(8, 30, DEFAULT_RPN_THRESHOLDS), 'orange')

assert.deepEqual(
  plain(normalizeRpnThresholds({ greenMax: 250.9, orangeMax: 50, yellowMax: 120 })),
  { greenMax: 250, orangeMax: 250, yellowMax: 250 }
)

assert.equal(
  riskColorForMatrixCell(5, 12, 'manual', DEFAULT_RPN_THRESHOLDS, { '5|12': 'red' }),
  'red'
)
assert.equal(
  riskColorForMatrixCell(5, 12, 'manual', DEFAULT_RPN_THRESHOLDS, {}, () => 'yellow'),
  'yellow'
)
assert.equal(
  riskColorForMatrixCell(5, 12, 'rpn', DEFAULT_RPN_THRESHOLDS, { '5|12': 'red' }),
  'green'
)
assert.equal(riskColorForMatrixCell(null, 12, 'rpn', DEFAULT_RPN_THRESHOLDS, {}), null)

console.log('risk-engine smoke passed')
