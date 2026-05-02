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
  buildPcpRowPayload,
  getComparableTime,
  isEquivalentPcpRow,
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
assert.equal(
  JSON.stringify(buildPcpRowPayload({
    operation_id: 'op-1',
    revision_id: 'rev-1',
    failure_mode: null,
    characteristic: 'Width',
    class: 'special characteristic',
    source: 'manual',
    status: '',
  })),
  JSON.stringify({
    operation_id: 'op-1',
    revision_id: 'rev-1',
    pfmea_row_id: null,
    failure_mode: '',
    characteristic: 'Width',
    class: 'SC',
    current_prevention: '',
    current_detection: '',
    control_method: '',
    sample_size: '',
    frequency: '',
    reaction_plan: '',
    source: 'MANUAL',
    status: 'OPEN',
  })
)
assert.equal(isEquivalentPcpRow({ pfmea_row_id: 'pfmea-1' }, { pfmea_row_id: 'pfmea-1' }), true)
assert.equal(
  isEquivalentPcpRow(
    { operation_id: 'op', failure_mode: 'FM', characteristic: 'C', class: 'SC', current_prevention: 'P', current_detection: 'D' },
    { operation_id: 'op', failure_mode: 'FM', characteristic: 'C', class: 'Special Characteristic', current_prevention: 'P', current_detection: 'D' }
  ),
  true
)
assert.equal(getComparableTime('2026-05-02T10:00:00.000Z') > 0, true)
assert.equal(getComparableTime('not-a-date'), 0)

console.log('pcp utils smoke passed')
