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

const { normalizeClassValue, normalizePfmeaPcpValue } = loadModule(['src', 'features', 'pfmea', 'pfmea-value-utils.ts'])

assert.equal(normalizeClassValue('SC - Special Characteristic'), 'SC')
assert.equal(normalizeClassValue('critical characteristic'), 'CC')
assert.equal(normalizeClassValue('unknown'), null)
assert.equal(normalizePfmeaPcpValue('yes'), true)
assert.equal(normalizePfmeaPcpValue('0'), false)
assert.equal(normalizePfmeaPcpValue('maybe'), null)

console.log('pfmea value utils smoke passed')
