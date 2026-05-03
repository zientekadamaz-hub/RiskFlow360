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
  PFMEA_REPORT_RISK_FIELDS,
  PFMEA_REPORT_RISK_SELECT,
  PFMEA_REPORT_RISK_SELECT_WITH_REVISION,
} = loadModule(['src', 'features', 'reports', 'pfmea-report-query.ts'])

assert.ok(PFMEA_REPORT_RISK_FIELDS.includes('occurrence2'))
assert.ok(PFMEA_REPORT_RISK_FIELDS.includes('detection2'))
assert.ok(PFMEA_REPORT_RISK_SELECT.includes('operations!inner(project_id)'))
assert.ok(PFMEA_REPORT_RISK_SELECT_WITH_REVISION.startsWith('revision_id,'))
assert.equal(PFMEA_REPORT_RISK_SELECT.includes('active'), false)
assert.equal(PFMEA_REPORT_RISK_SELECT_WITH_REVISION.includes('active'), false)

console.log('pfmea report query smoke passed')
