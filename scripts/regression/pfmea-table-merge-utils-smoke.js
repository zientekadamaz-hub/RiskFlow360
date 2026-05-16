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
  buildPfmeaBlockMergeInfoByHierarchy,
  buildPfmeaHierarchy,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-hierarchy-utils.ts'])
const {
  buildPfmeaOperationMergeInfo,
  findPfmeaMergeOwnerRow,
  resolvePfmeaBlockEndAnchorRow,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-table-merge-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const rows = [
  {
    id: 'effect-1-cause-1',
    operation_id: 'op-1',
    row_no: '10.1.1.1.1',
    failure_mode_group_id: 'fm-1',
    failure_block_group_id: 'fb-1',
    action_plan_group_id: 'ap-1',
    operations: { id: 'op-1', operation_number: 10, machine: 'A', operation: 'Mount', name: 'Tire replacement' },
  },
  {
    id: 'effect-1-cause-2',
    operation_id: 'op-1',
    row_no: '10.1.1.2.1',
    failure_mode_group_id: 'fm-1',
    failure_block_group_id: 'fb-1',
    action_plan_group_id: 'ap-2',
    operations: { id: 'op-1', operation_number: 10, machine: 'A', operation: 'Mount', name: 'Tire replacement' },
  },
  {
    id: 'effect-2-cause-1',
    operation_id: 'op-1',
    row_no: '10.1.2.1.1',
    failure_mode_group_id: 'fm-1',
    failure_block_group_id: 'fb-2',
    action_plan_group_id: 'ap-3',
    operations: { id: 'op-1', operation_number: 10, machine: 'A', operation: 'Mount', name: 'Tire replacement' },
  },
  {
    id: 'failure-mode-2',
    operation_id: 'op-1',
    row_no: '10.2.1.1.1',
    failure_mode_group_id: 'fm-2',
    failure_block_group_id: 'fb-3',
    action_plan_group_id: 'ap-4',
    operations: { id: 'op-1', operation_number: 10, machine: 'A', operation: 'Mount', name: 'Tire replacement' },
  },
  {
    id: 'next-operation',
    operation_id: 'op-2',
    row_no: '20.1.1.1.1',
    failure_mode_group_id: 'fm-3',
    failure_block_group_id: 'fb-4',
    action_plan_group_id: 'ap-5',
    operations: { id: 'op-2', operation_number: 20, machine: 'B', operation: 'Balance', name: 'Wheel balancing' },
  },
]

const hierarchy = buildPfmeaHierarchy(rows)
const operationMergeInfo = buildPfmeaOperationMergeInfo(rows)
const failureModeMergeInfo = buildPfmeaBlockMergeInfoByHierarchy(rows, hierarchy, (item) => item.failureModeKey)
const failureBlockMergeInfo = buildPfmeaBlockMergeInfoByHierarchy(rows, hierarchy, (item) => item.failureBlockKey)
const actionPlanMergeInfo = buildPfmeaBlockMergeInfoByHierarchy(rows, hierarchy, (item) => item.causeBlockKey)

assertJsonEqual(operationMergeInfo, [
  { span: 4, end: 3 },
  { span: 0, end: 3 },
  { span: 0, end: 3 },
  { span: 0, end: 3 },
  { span: 1, end: 4 },
])

assert.equal(findPfmeaMergeOwnerRow(rows, 1, failureModeMergeInfo)?.id, 'effect-1-cause-1')
assert.equal(findPfmeaMergeOwnerRow(rows, 1, failureBlockMergeInfo)?.id, 'effect-1-cause-1')
assert.equal(findPfmeaMergeOwnerRow(rows, 1, actionPlanMergeInfo)?.id, 'effect-1-cause-2')

assert.equal(resolvePfmeaBlockEndAnchorRow(rows, 0, failureModeMergeInfo)?.id, 'effect-2-cause-1')
assert.equal(resolvePfmeaBlockEndAnchorRow(rows, 0, failureBlockMergeInfo)?.id, 'effect-1-cause-2')
assert.equal(resolvePfmeaBlockEndAnchorRow(rows, 1, actionPlanMergeInfo)?.id, 'effect-1-cause-2')
assert.equal(resolvePfmeaBlockEndAnchorRow(rows, 2, failureBlockMergeInfo)?.id, 'effect-2-cause-1')

console.log('pfmea table merge utils smoke passed')
