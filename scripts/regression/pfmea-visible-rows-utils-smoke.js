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
      if (request === './pfmea-operation-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-operation-utils.ts'])
      if (request === './pfmea-row-factory-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-row-factory-utils.ts'])
      if (request === './pfmea-hierarchy-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-hierarchy-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  buildPfmeaDisplayOperations,
  buildPfmeaTableRows,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-visible-rows-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

function row(id, op) {
  return {
    id,
    revision_id: 'rev-open',
    operation_id: op.id,
    row_no: null,
    failure_mode: '',
    effect: '',
    severity: null,
    characteristic: '',
    pcp: null,
    class: null,
    cause: '',
    occurrence: null,
    current_prevention: '',
    current_detection: '',
    detection: null,
    rpn: null,
    oxd: null,
    recommended_action: '',
    responsible: '',
    target_date: null,
    action_status: null,
    occurrence2: null,
    detection2: null,
    rpn2: null,
    oxd2: null,
    rpn_current: null,
    oxd_current: null,
    created_at: '',
    operations: op,
  }
}

const operations = [
  { id: 'op-20-empty', project_id: 'project-1', operation_number: 20, name: 'Balance', machine: 'B', operation: 'Balance', active: true },
  { id: 'op-10-pfd', project_id: 'project-1', operation_number: 10, name: '', machine: '', operation: '', active: true },
  { id: 'op-30-inactive', project_id: 'project-1', operation_number: 30, name: 'Inactive', machine: 'C', operation: 'Skip', active: false },
]

const rows = [
  row('r-10-a', { id: 'op-10-row', project_id: 'project-1', operation_number: 10, name: 'Mount tire', machine: 'A', operation: 'Mount', active: true }),
  row('r-10-b', { id: 'op-10-row', project_id: 'project-1', operation_number: 10, name: 'Mount tire', machine: 'A', operation: 'Mount', active: true }),
  row('r-30-from-row', { id: 'op-30-row', project_id: 'project-1', operation_number: 30, name: 'Inflate', machine: 'C', operation: 'Inflate', active: true }),
  row('r-orphan', { id: '', project_id: 'project-1', operation_number: null, name: '', machine: null, operation: null, active: true }),
]
rows[3].operation_id = ''
rows[3].operations = null

const displayOps = buildPfmeaDisplayOperations(operations, rows)
assertJsonEqual(
  displayOps.map((op) => [op.id, op.name]),
  [
    ['op-10-row', 'Mount tire'],
    ['op-20-empty', 'Balance'],
    ['op-30-row', 'Inflate'],
  ]
)

const tableRows = buildPfmeaTableRows(displayOps, rows, 'rev-draft')
assertJsonEqual(
  tableRows.map((item) => item.id),
  ['r-10-a', 'r-10-b', '__pfmea_placeholder__:op-20-empty:base:op-20-empty', 'r-30-from-row', 'r-orphan']
)

const placeholder = tableRows[2]
assert.equal(placeholder.revision_id, 'rev-draft')
assert.equal(placeholder.operation_id, 'op-20-empty')
assert.equal(placeholder.__sortIndex, 2)
assert.equal(placeholder.operations.name, 'Balance')

console.log('pfmea visible rows utils smoke passed')
