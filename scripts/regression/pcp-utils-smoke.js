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
  uniqueSelectedPfmeaPcpSeedRows,
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
    { operation_id: 'op', pfmea_row_id: 'pfmea-action-1', failure_mode: 'FM', characteristic: 'C', class: 'SC', current_prevention: 'P', current_detection: 'D' },
    { operation_id: 'op', pfmea_row_id: 'pfmea-action-2', failure_mode: 'FM', characteristic: 'C', class: 'SC', current_prevention: 'P', current_detection: 'D' }
  ),
  true,
  'PCP equivalence must be based on PFMEA risk/control context before action-row id.'
)
assert.equal(
  isEquivalentPcpRow(
    { operation_id: 'op', failure_mode: 'FM', characteristic: 'C', class: 'SC', current_prevention: 'P', current_detection: 'D' },
    { operation_id: 'op', failure_mode: 'FM', characteristic: 'C', class: 'Special Characteristic', current_prevention: 'P', current_detection: 'D' }
  ),
  true
)
assert.equal(
  JSON.stringify(uniqueSelectedPfmeaPcpSeedRows(
    [
      { id: 'action-1', operation_id: 'op', pcp: null, failure_mode: 'FM', characteristic: 'C', class: null, severity: 8, rpn: 220, current_prevention: 'P', current_detection: 'D', created_at: '2026-05-01T10:00:00.000Z' },
      { id: 'action-2', operation_id: 'op', pcp: null, failure_mode: 'FM', characteristic: 'C', class: null, severity: 8, rpn: 220, current_prevention: 'P', current_detection: 'D', created_at: '2026-05-01T10:01:00.000Z' },
      { id: 'other-risk', operation_id: 'op', pcp: null, failure_mode: 'FM', characteristic: 'C', class: null, severity: 3, rpn: 20, current_prevention: 'P2', current_detection: 'D2', created_at: '2026-05-01T10:02:00.000Z' },
    ],
    168
  ).map((row) => row.id)),
  JSON.stringify(['action-1']),
  'Multiple PFMEA action rows in the same risk/control context must create one PCP seed.'
)
assert.equal(getComparableTime('2026-05-02T10:00:00.000Z') > 0, true)
assert.equal(getComparableTime('not-a-date'), 0)

console.log('pcp utils smoke passed')
