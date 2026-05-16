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

const { computePfmeaAverageRpnSummary } = loadModule(['src', 'features', 'pfmea', 'pfmea-summary-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const rows = [
  { id: 'green', currentRisk: { sev: 1, doVal: 4, rpn: 4 } },
  { id: 'yellow', currentRisk: { sev: 5, doVal: 20, rpn: 100 } },
  { id: 'orange', currentRisk: { sev: 8, doVal: 36, rpn: 288 } },
  { id: 'invalid', currentRisk: { sev: null, doVal: null, rpn: null } },
]

const summary = computePfmeaAverageRpnSummary(
  rows,
  (row) => row.currentRisk,
  (sev, doVal) => {
    if (sev == null || doVal == null) return null
    if (sev <= 2) return 'green'
    if (sev <= 6) return 'yellow'
    return 'orange'
  },
  (avg) => (avg >= 100 ? 'orange' : 'green')
)

assert.equal(summary.avg, (4 + 100 + 288) / 3)
assert.equal(summary.color, 'orange')
assert.equal(summary.count, 3)
assertJsonEqual(summary.buckets, { green: 1, yellow: 1, orange: 1, red: 0 })

const emptySummary = computePfmeaAverageRpnSummary(
  [{ id: 'empty', currentRisk: { sev: null, doVal: null, rpn: null } }],
  (row) => row.currentRisk,
  () => null,
  () => 'red'
)

assertJsonEqual(emptySummary, {
  avg: null,
  color: null,
  count: 0,
  buckets: { green: 0, yellow: 0, orange: 0, red: 0 },
})

console.log('pfmea summary utils smoke passed')
