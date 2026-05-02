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
      if (request === './pfmea-risk-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-utils.ts'])
      if (request === './pfmea-value-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-value-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const { getPfmeaPcpAutoReasons, isPfmeaSelectedForPcp } = loadModule(['src', 'features', 'pfmea', 'pfmea-pcp-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

assertJsonEqual(getPfmeaPcpAutoReasons({ pcp: null, class: 'SC', severity: 9 }, 'red'), ['CLASS = SC', 'SEV = 9', 'RPN = RED'])
assertJsonEqual(getPfmeaPcpAutoReasons({ pcp: null, class: null, severity: 4 }, 'green'), [])
assert.equal(isPfmeaSelectedForPcp({ pcp: true, class: null, severity: 1 }, null), true)
assert.equal(isPfmeaSelectedForPcp({ pcp: false, class: 'CC', severity: 10 }, 'red'), false)
assert.equal(isPfmeaSelectedForPcp({ pcp: null, class: null, severity: 8 }, 'orange'), true)

console.log('pfmea pcp utils smoke passed')
