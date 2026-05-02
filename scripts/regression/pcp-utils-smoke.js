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
  PCP_PLACEHOLDER_PREFIX,
  asInt1to10,
  isPfmeaSeedSelectedForPcp,
  isPlaceholderPcpRowId,
  nextPcpRevisionLabel,
  normalizeClassValue,
  normalizePcpFlag,
  normalizeText,
} = loadModule(['src', 'features', 'pcp', 'pcp-utils.ts'])

assert.equal(normalizeText('  abc  '), 'abc')
assert.equal(normalizePcpFlag('yes'), true)
assert.equal(normalizePcpFlag('0'), false)
assert.equal(normalizePcpFlag('maybe'), null)
assert.equal(normalizeClassValue('Special Characteristic'), 'SC')
assert.equal(normalizeClassValue('cc - safety'), 'CC')
assert.equal(normalizeClassValue('normal'), null)
assert.equal(asInt1to10('9.8'), 9)
assert.equal(asInt1to10('11'), null)
assert.equal(isPfmeaSeedSelectedForPcp({ pcp: false, class: 'SC', severity: 10, rpn: 400 }, 168), false)
assert.equal(isPfmeaSeedSelectedForPcp({ pcp: null, class: null, severity: 9, rpn: 20 }, 168), true)
assert.equal(isPfmeaSeedSelectedForPcp({ pcp: null, class: null, severity: 3, rpn: 200 }, 168), true)
assert.equal(nextPcpRevisionLabel('1.2.3'), '1.2.4')
assert.equal(nextPcpRevisionLabel('bad'), '0.0.1')
assert.equal(isPlaceholderPcpRowId(`${PCP_PLACEHOLDER_PREFIX}abc`), true)
assert.equal(isPlaceholderPcpRowId('abc'), false)

console.log('pcp utils smoke passed')
