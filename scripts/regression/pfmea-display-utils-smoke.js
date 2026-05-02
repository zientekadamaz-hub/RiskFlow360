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

const { normalizeHistoryText, parseExamples, shortSeverityLabel, toFiniteNumber } = loadModule([
  'src',
  'features',
  'pfmea',
  'pfmea-display-utils.ts',
])

assert.equal(shortSeverityLabel(null, 'High - safety effect\nsecondary'), 'High')
assert.equal(shortSeverityLabel('', ''), 'No description')
assert.equal(JSON.stringify(parseExamples(' a \r\n\n b ')), JSON.stringify(['a', 'b']))
assert.equal(normalizeHistoryText('  saved  '), 'saved')
assert.equal(normalizeHistoryText(12), '')
assert.equal(toFiniteNumber('144'), 144)
assert.equal(toFiniteNumber(Number.POSITIVE_INFINITY), null)

console.log('pfmea display utils smoke passed')
