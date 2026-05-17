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
      if (request === './pfmea-risk-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-risk-utils.ts'])
      if (request === './pfmea-value-utils') return loadModule(['src', 'features', 'pfmea', 'pfmea-value-utils.ts'])
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  buildPfmeaRowContentKey,
  buildPfmeaRowMatchKey,
  findEquivalentPfmeaRow,
  findEquivalentPublishedPfmeaRow,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-row-match-utils.ts'])

const base = {
  id: 'source',
  operation_id: 'op-1',
  row_no: '10.1.1.1.1',
  failure_mode_group_id: 'fm-1',
  failure_block_group_id: 'fb-1',
  action_plan_group_id: 'ap-1',
  failure_mode: 'Void',
  effect: 'Weak insulation',
  severity: '6',
  characteristic: 'Thickness',
  class: 'special characteristic',
  cause: 'Air trapped',
  occurrence: 3,
  current_prevention: 'Degassing',
  current_detection: 'Visual check',
  detection: 3,
  recommended_action: 'Improve fixture',
  responsible: 'Quality',
  target_date: '2026-05-10',
  action_status: 'Open',
  occurrence2: 2,
  detection2: 2,
  created_at: '2026-05-02T10:00:00.000Z',
}

assert.equal(buildPfmeaRowMatchKey(base), buildPfmeaRowMatchKey({ ...base, id: 'copy', class: 'SC' }))
assert.equal(buildPfmeaRowContentKey(base), buildPfmeaRowContentKey({ ...base, id: 'copy', row_no: '10.9.9.9.9' }))

const rows = [
  { ...base, id: 'row-a', row_no: '10.1.1.1.1' },
  { ...base, id: 'row-b', operation_id: 'op-2', row_no: '10.1.1.1.1' },
]
assert.equal(findEquivalentPfmeaRow(rows, { ...base, id: 'source-copy' })?.id, 'row-a')
assert.equal(findEquivalentPublishedPfmeaRow(rows, { ...base, id: 'source-copy' })?.id, 'row-a')
assert.equal(findEquivalentPfmeaRow(rows, { ...base, operation_id: 'missing-op' }), null)

const draftRowsWithDuplicateRowNo = [
  { ...base, id: 'draft-a', row_no: '10.1.1.1.1', failure_mode_group_id: 'fm-1', failure_block_group_id: 'fb-1', action_plan_group_id: 'ap-1' },
  { ...base, id: 'draft-b', row_no: '10.1.1.1.1', failure_mode_group_id: 'fm-2', failure_block_group_id: 'fb-2', action_plan_group_id: 'ap-2' },
]
assert.equal(
  findEquivalentPfmeaRow(draftRowsWithDuplicateRowNo, { ...base, id: 'source-copy', row_no: '10.1.1.1.1' })?.id,
  'draft-a',
  'Draft row matching should use PFMEA group ids when a duplicated row_no is not enough.'
)

const draftRowsWithMisleadingRowNo = [
  { ...base, id: 'draft-wrong-row-no', row_no: '10.1.1.1.1', failure_mode_group_id: 'fm-x', failure_block_group_id: 'fb-x', action_plan_group_id: 'ap-x' },
  { ...base, id: 'draft-correct-group', row_no: '10.9.9.9.9', failure_mode_group_id: 'fm-1', failure_block_group_id: 'fb-1', action_plan_group_id: 'ap-1' },
]
assert.equal(
  findEquivalentPfmeaRow(draftRowsWithMisleadingRowNo, { ...base, id: 'source-copy', row_no: '10.1.1.1.1' })?.id,
  'draft-correct-group',
  'Draft row matching should prefer stable PFMEA group ids over stale row_no metadata.'
)
assert.equal(
  findEquivalentPublishedPfmeaRow(draftRowsWithMisleadingRowNo, { ...base, id: 'source-copy', row_no: '10.1.1.1.1' })?.id,
  'draft-correct-group',
  'Published row matching should prefer stable PFMEA group ids over stale row_no metadata.'
)

const draftRowsWithChangedMetadata = [
  {
    ...base,
    id: 'draft-content-a',
    row_no: '10.9.9.9.9',
    created_at: '2026-05-03T10:00:00.000Z',
    failure_mode_group_id: '',
    failure_block_group_id: '',
    action_plan_group_id: '',
  },
]
assert.equal(
  findEquivalentPfmeaRow(
    draftRowsWithChangedMetadata,
    { ...base, failure_mode_group_id: '', failure_block_group_id: '', action_plan_group_id: '' },
    { allowContentFallback: true }
  )?.id,
  'draft-content-a',
  'Draft integrity matching should tolerate changed ordering metadata when row content is unique.'
)

const publishedRowsWithNewMetadata = [
  {
    ...base,
    id: 'published-a',
    row_no: '20.9.9.9.9',
    created_at: '2026-05-03T10:00:00.000Z',
    failure_mode_group_id: 'published-fm',
    failure_block_group_id: 'published-fb',
    action_plan_group_id: 'published-ap',
  },
]
assert.equal(
  findEquivalentPfmeaRow(publishedRowsWithNewMetadata, base),
  null,
  'Draft row matching should stay strict when publish metadata changes.'
)
assert.equal(
  findEquivalentPublishedPfmeaRow(publishedRowsWithNewMetadata, base)?.id,
  'published-a',
  'Published row matching must tolerate changed row/order metadata when row content is stable.'
)

console.log('pfmea row match utils smoke passed')
