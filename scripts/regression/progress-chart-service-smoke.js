const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const serviceSource = fs.readFileSync(path.join(root, 'src', 'features', 'reports', 'progress-chart', 'progress-chart-service.ts'), 'utf8')

function loadModule(relativePath) {
  const sourcePath = path.join(root, ...relativePath)
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
      if (request === '@/features/reports/pfmea-report-risk-utils') {
        return loadModule(['src', 'features', 'reports', 'pfmea-report-risk-utils.ts'])
      }
      if (request === '@/features/reports/pfmea-report-query') {
        return loadModule(['src', 'features', 'reports', 'pfmea-report-query.ts'])
      }
      if (
        request === '@/features/projects/projects-service' ||
        request === '@/features/reports/report-project-scope'
      ) {
        return {}
      }
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const { summarizeProgressCurrentRows } = loadModule(['src', 'features', 'reports', 'progress-chart', 'progress-chart-service.ts'])

assert.match(serviceSource, /PFMEA_REPORT_RISK_SELECT_WITH_ACTIVE_OPERATION/, 'Progress Chart current summary must request operation active state.')
assert.match(serviceSource, /\.eq\('operations\.active', true\)/, 'Progress Chart current summary must align with Projects by excluding inactive operations.')

const summary = summarizeProgressCurrentRows([
  { severity: 10, occurrence: 10, detection: 10, rpn_current: 72 },
  { severity: 8, occurrence: 9, detection: 9, rpn: 144 },
  { severity: 5, occurrence: 4, detection: 4 },
])

assert.equal(summary.count, 3)
assert.equal(summary.averageRpn, 98.7)

const closedSummary = summarizeProgressCurrentRows([
  { action_status: 'CLOSED', severity: 10, occurrence: 10, detection: 10, occurrence2: 1, detection2: 1, rpn_current: 1000 },
])

assert.equal(
  closedSummary.averageRpn,
  1000,
  'Progress Chart current summary must align with Projects by preferring saved current RPN.'
)

console.log('progress chart service smoke passed')
