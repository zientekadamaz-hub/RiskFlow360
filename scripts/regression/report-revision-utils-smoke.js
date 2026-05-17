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

const { getReportRevisionId } = loadModule(['src', 'features', 'reports', 'report-revision-utils.ts'])

assert.equal(getReportRevisionId({ status: 'OPEN', current_open_revision_id: 'open', current_draft_revision_id: 'draft' }), 'draft')
assert.equal(getReportRevisionId({ status: 'OPEN', current_open_revision_id: '', current_draft_revision_id: 'draft' }), 'draft')
assert.equal(getReportRevisionId({ status: 'DRAFT', current_open_revision_id: 'open', current_draft_revision_id: 'draft' }), 'draft')
assert.equal(getReportRevisionId({ status: 'DRAFT', current_open_revision_id: 'open', current_draft_revision_id: '' }), 'open')

console.log('report revision utils smoke passed')
