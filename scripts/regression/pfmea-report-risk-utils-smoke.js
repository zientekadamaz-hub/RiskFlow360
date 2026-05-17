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
    require,
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  collectPfmeaCurrentOpenRisks,
  getPfmeaCurrentOpenRisk,
  getPfmeaReportRisk,
  toReportNumber,
} = loadModule(['src', 'features', 'reports', 'pfmea-report-risk-utils.ts'])

assert.equal(toReportNumber('12'), 12)
assert.equal(toReportNumber('x'), null)
let risk = getPfmeaReportRisk({ severity: 10, occurrence: 10, detection: 10, rpn_current: 1000 })
assert.equal(risk.severity, 10)
assert.equal(risk.doValue, 100)
assert.equal(risk.rpn, 1000)

risk = getPfmeaReportRisk({
    action_status: 'CLOSED',
    severity: 10,
    occurrence: 10,
    detection: 10,
    occurrence2: 9,
    detection2: 7,
    rpn_current: 1000,
  })
assert.equal(risk.severity, 10)
assert.equal(risk.doValue, 63)
assert.equal(risk.rpn, 630)

risk = getPfmeaReportRisk({ severity: null, oxd_current: 12, rpn_current: 60 })
assert.equal(risk.severity, null)
assert.equal(risk.doValue, 12)
assert.equal(risk.rpn, 60)

let currentRisk = getPfmeaCurrentOpenRisk({
  action_status: 'CLOSED',
  severity: 10,
  occurrence: 10,
  detection: 10,
  occurrence2: 9,
  detection2: 7,
  oxd_current: 100,
  rpn_current: 1000,
})
assert.equal(currentRisk.severity, 10)
assert.equal(currentRisk.doValue, 100)
assert.equal(currentRisk.rpn, 1000)

currentRisk = getPfmeaCurrentOpenRisk({ severity: 8, occurrence: 9, detection: 9, oxd_current: 10, rpn_current: 80 })
assert.equal(currentRisk.doValue, 10)
assert.equal(currentRisk.rpn, 80)

const collectedRisks = collectPfmeaCurrentOpenRisks([
  {
    id: 'risk-a-owner',
    revision_id: 'rev-1',
    operation_id: 'op-1',
    action_plan_group_id: 'risk-a',
    severity: 8,
    occurrence: 9,
    detection: 9,
    oxd_current: 81,
    rpn_current: 648,
  },
  {
    id: 'risk-a-action',
    revision_id: 'rev-1',
    operation_id: 'op-1',
    action_plan_group_id: 'risk-a',
    oxd_current: 63,
    rpn_current: 504,
  },
  {
    id: 'risk-b-owner',
    revision_id: 'rev-1',
    operation_id: 'op-1',
    action_plan_group_id: 'risk-b',
    severity: 1,
    occurrence: 2,
    detection: 2,
  },
])

assert.equal(collectedRisks.length, 2)
assert.equal(collectedRisks[0].severity, 8)
assert.equal(collectedRisks[0].doValue, 63)
assert.equal(collectedRisks[0].rpn, 504)
assert.equal(collectedRisks[1].rpn, 4)

console.log('pfmea report risk utils smoke passed')
