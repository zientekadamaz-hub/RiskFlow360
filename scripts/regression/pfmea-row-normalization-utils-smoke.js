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
      if (request === './pfmea-hierarchy-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-hierarchy-utils.ts'])
      if (request === './pfmea-value-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-value-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const { hydratePfmeaGroupIds } = loadModule(['src', 'features', 'pfmea', 'pfmea-row-normalization-utils.ts'])

const [row] = hydratePfmeaGroupIds([
  {
    id: 'row-1',
    operation_id: 'op-1',
    row_no: '10.1.1.1.1',
    pcp: 'yes',
  },
])

assert.equal(row.pcp, true)
assert.equal(typeof row.failure_mode_group_id, 'string')
assert.equal(typeof row.failure_block_group_id, 'string')
assert.equal(typeof row.action_plan_group_id, 'string')

console.log('pfmea row normalization utils smoke passed')
