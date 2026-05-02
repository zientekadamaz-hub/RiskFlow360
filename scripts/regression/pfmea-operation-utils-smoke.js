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

const {
  getOperationNodeIdsFromDiagram,
  opGroupKeyFromOperation,
  opGroupKeyFromRow,
  opQualityScore,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-operation-utils.ts'])

assert.equal(opGroupKeyFromOperation({ id: 'op-a', operation_number: 20 }), 'no:20')
assert.equal(opGroupKeyFromOperation({ id: 'op-b', operation_number: null }), 'id:op-b')
assert.equal(opGroupKeyFromRow({ operation_id: 'op-c', operations: { id: 'op-rel', operation_number: 30 } }), 'no:30')
assert.equal(opGroupKeyFromRow({ operation_id: '', operations: { id: 'op-rel', operation_number: null } }), 'id:op-rel')
assert.equal(opQualityScore({ id: 'op', operation_number: 10, name: 'Name', machine: 'Station', operation: 'Operation' }, 4), 1119)

const ids = getOperationNodeIdsFromDiagram({
  nodes: [
    { id: 'op-1', data: { kind: 'operation' } },
    { id: 'start', data: { kind: 'start' } },
    { id: ' ', data: { kind: 'operation' } },
  ],
})
assert.equal(JSON.stringify(Array.from(ids)), JSON.stringify(['op-1']))

console.log('pfmea operation utils smoke passed')
