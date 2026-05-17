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

const dedupedSummary = computePfmeaAverageRpnSummary(
  [
    { id: 'risk-a-action-1', riskKey: 'risk-a', currentRisk: { sev: 9, doVal: 49, rpn: 441 } },
    { id: 'risk-a-action-2', riskKey: 'risk-a', currentRisk: { sev: 8, doVal: 36, rpn: 288 } },
    { id: 'risk-b-action-1', riskKey: 'risk-b', currentRisk: { sev: 1, doVal: 4, rpn: 4 } },
  ],
  (row) => row.currentRisk,
  (sev) => (sev === 8 ? 'orange' : 'green'),
  (avg) => (avg >= 100 ? 'orange' : 'green'),
  { getRiskKey: (row) => row.riskKey }
)

assert.equal(dedupedSummary.avg, (288 + 4) / 2)
assert.equal(dedupedSummary.count, 2)
assertJsonEqual(dedupedSummary.buckets, { green: 1, yellow: 0, orange: 1, red: 0 })

const closedActionSummary = computePfmeaAverageRpnSummary(
  [
    {
      id: 'risk-a-open-action',
      riskKey: 'risk-a',
      status: 'OPEN',
      currentRisk: { sev: 9, doVal: 90, rpn: 810 },
      residualRisk: { sev: 9, doVal: 4, rpn: 36 },
    },
    {
      id: 'risk-a-closed-higher',
      riskKey: 'risk-a',
      status: 'CLOSED',
      currentRisk: { sev: 9, doVal: 90, rpn: 810 },
      residualRisk: { sev: 9, doVal: 20, rpn: 180 },
    },
    {
      id: 'risk-a-closed-lowest',
      riskKey: 'risk-a',
      status: 'CLOSED',
      currentRisk: { sev: 9, doVal: 90, rpn: 810 },
      residualRisk: { sev: 9, doVal: 5, rpn: 45 },
    },
    {
      id: 'risk-b-current',
      riskKey: 'risk-b',
      status: '',
      currentRisk: { sev: 5, doVal: 20, rpn: 100 },
      residualRisk: { sev: 5, doVal: 1, rpn: 5 },
    },
  ],
  (row) => row.currentRisk,
  (sev, doVal) => {
    if (sev == null || doVal == null) return null
    if (doVal <= 5) return 'green'
    if (doVal <= 20) return 'yellow'
    return 'red'
  },
  (avg) => (avg >= 100 ? 'orange' : 'green'),
  {
    getResidualRisk: (row) => row.residualRisk,
    getRiskKey: (row) => row.riskKey,
    isClosedAction: (row) => row.status === 'CLOSED',
  }
)

assert.equal(closedActionSummary.avg, (45 + 100) / 2)
assert.equal(closedActionSummary.count, 2)
assertJsonEqual(closedActionSummary.buckets, { green: 1, yellow: 1, orange: 0, red: 0 })

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
