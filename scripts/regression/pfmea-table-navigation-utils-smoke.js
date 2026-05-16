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
      if (request === './pfmea-columns') return loadModule(['src', 'features', 'pfmea', 'pfmea-columns.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  buildPfmeaEditableColumnOrder,
  getNextPfmeaCellPosition,
  getPreviousPfmeaCellPosition,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-table-navigation-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const visibleIds = new Set(['failure_mode', 'class', 'effect', 'cause', 'recommended_action'])
const order = buildPfmeaEditableColumnOrder((id) => visibleIds.has(id))

assertJsonEqual(order, ['failure_mode', 'class', 'effect', 'cause', 'recommended_action'])
assertJsonEqual(getNextPfmeaCellPosition(0, 0, order, 3), { r: 0, c: 1 })
assertJsonEqual(getNextPfmeaCellPosition(0, 4, order, 3), { r: 1, c: 0 })
assertJsonEqual(getNextPfmeaCellPosition(2, 4, order, 3), { r: 2, c: 0 })
assertJsonEqual(getPreviousPfmeaCellPosition(1, 0, order), { r: 0, c: 4 })
assertJsonEqual(getPreviousPfmeaCellPosition(0, 0, order), { r: 0, c: 4 })
assertJsonEqual(getNextPfmeaCellPosition(5, 2, [], 0), { r: 5, c: 0 })
assertJsonEqual(getPreviousPfmeaCellPosition(5, 2, []), { r: 5, c: 0 })

console.log('pfmea table navigation utils smoke passed')
