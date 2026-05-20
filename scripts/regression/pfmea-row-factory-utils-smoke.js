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
      if (request === './pfmea-risk-uid-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-uid-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const { makeEmptyPfmeaPayload, makePlaceholderRow } = loadModule(['src', 'features', 'pfmea', 'pfmea-row-factory-utils.ts'])

const groups = {
  failure_mode_group_id: 'fm',
  failure_block_group_id: 'fb',
  action_plan_group_id: 'ap',
}
const empty = makeEmptyPfmeaPayload('op-1', 'rev-1', groups)
assert.equal(empty.operation_id, 'op-1')
assert.equal(empty.revision_id, 'rev-1')
assert.match(empty.risk_uid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
assert.equal(empty.failure_mode_group_id, 'fm')
assert.equal(empty.failure_mode, '')
assert.equal(empty.pcp, null)

const placeholder = makePlaceholderRow(
  {
    id: 'op-1',
    project_id: 'project-1',
    operation_number: 10,
    name: 'Operation',
    machine: 'Station',
    operation: 'Mount',
    active: true,
  },
  'rev-1',
  'token',
  3
)
assert.equal(placeholder.id, '__pfmea_placeholder__:op-1:token')
assert.match(placeholder.risk_uid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
assert.equal(placeholder.__sortIndex, 3)
assert.equal(placeholder.operations.project_id, 'project-1')

console.log('pfmea row factory utils smoke passed')
