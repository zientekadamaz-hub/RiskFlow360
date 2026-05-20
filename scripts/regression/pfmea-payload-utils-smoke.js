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
      if (request === './pfmea-risk-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-utils.ts'])
      if (request === './pfmea-row-order-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-row-order-utils.ts'])
      if (request === './pfmea-value-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-value-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  PFMEA_CLONE_FIELDS,
  PFMEA_CLONE_FIELDS_LEGACY,
  PFMEA_SELECT_FIELDS,
  PFMEA_SELECT_FIELDS_LEGACY,
  buildPfmeaInsertPayloadForRevision,
  buildPfmeaPublishedMetadataPatch,
  buildPfmeaPublishedSyncPatch,
  isMissingPfmeaGroupIdColumnError,
  stripPfmeaGroupIdsFromPayload,
  summarizePfmeaRowsForError,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-payload-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const row = {
  id: 'row-1',
  risk_uid: '11111111-1111-4111-8111-111111111111',
  operation_id: 'op-1',
  row_no: ' 10.1.1.1.1 ',
  failure_mode_group_id: ' fm ',
  failure_block_group_id: 'fb',
  action_plan_group_id: '',
  failure_mode: 'Void',
  effect: 'Weak insulation',
  severity: '6',
  characteristic: 'Thickness',
  pcp: 'yes',
  class: 'special characteristic',
  cause: 'Air trapped',
  occurrence: '3',
  current_prevention: 'Degassing',
  current_detection: 'Visual check',
  detection: '4',
  rpn: 72,
  oxd: 12,
  recommended_action: 'Improve fixture',
  responsible: 'Quality',
  target_date: '',
  action_status: null,
  occurrence2: '2',
  detection2: '2',
  rpn2: 24,
  oxd2: 4,
  rpn_current: 72,
  oxd_current: 12,
  created_at: '2026-05-02T10:00:00.000Z',
}

const patch = buildPfmeaPublishedSyncPatch(row)
assert.equal(patch.risk_uid, '11111111-1111-4111-8111-111111111111')
assert.equal(patch.row_no, '10.1.1.1.1')
assert.equal(patch.failure_mode_group_id, 'fm')
assert.equal(patch.action_plan_group_id, null)
assert.equal(patch.pcp, true)
assert.equal(patch.class, 'SC')
assert.equal(patch.severity, 6)
assert.equal(patch.detection, 4)

assert.equal(PFMEA_CLONE_FIELDS.includes('row_no'), true)
assert.equal(PFMEA_CLONE_FIELDS.includes('risk_uid'), true)
assert.equal(PFMEA_CLONE_FIELDS_LEGACY.includes('row_no'), false)
assert.equal(PFMEA_SELECT_FIELDS.includes('operations!inner'), true)
assert.equal(PFMEA_SELECT_FIELDS_LEGACY.includes('failure_mode_group_id'), false)
assert.equal(isMissingPfmeaGroupIdColumnError({ message: 'column failure_mode_group_id does not exist' }), true)
assertJsonEqual(stripPfmeaGroupIdsFromPayload({ row_no: '1', failure_mode_group_id: 'fm', keep: 'value' }), { keep: 'value' })

const insert = buildPfmeaInsertPayloadForRevision(row, 'rev-2')
assert.equal(insert.revision_id, 'rev-2')
assert.equal(insert.operation_id, 'op-1')

assert.throws(() => buildPfmeaInsertPayloadForRevision({ ...row, operation_id: '', operations: null }, 'rev-2'), /missing operation_id/)

assertJsonEqual(buildPfmeaPublishedMetadataPatch({
  created_at: 'now',
  row_no: '1.1.1.1.1',
  failure_mode_group_id: 'fm',
  failure_block_group_id: 'fb',
  action_plan_group_id: 'ap',
}), {
  created_at: 'now',
  row_no: '1.1.1.1.1',
  failure_mode_group_id: 'fm',
  failure_block_group_id: 'fb',
  action_plan_group_id: 'ap',
})

assert.equal(summarizePfmeaRowsForError([row, { ...row, id: 'row-2', row_no: null, failure_mode: 'Crack' }]), '10.1.1.1.1, Crack')

console.log('pfmea payload utils smoke passed')
