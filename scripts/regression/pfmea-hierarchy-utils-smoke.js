const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'pfmea-hierarchy-utils.ts')
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

const {
  buildPfmeaBlockMergeInfoByHierarchy,
  buildPfmeaHierarchy,
  createDeterministicPfmeaGroupId,
  derivePfmeaGroupIds,
  normalizePfmeaGroupId,
  normalizePfmeaRowNo,
  parsePfmeaRowNo,
  parsePfmeaRowNoParts,
  samePfmeaGroupValue,
} = sandbox.module.exports

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

assert.equal(normalizePfmeaGroupId('  abc  '), 'abc')
assert.equal(normalizePfmeaGroupId('   '), null)
assert.equal(normalizePfmeaRowNo(' 10.1.2.3.4 '), '10.1.2.3.4')
assert.equal(parsePfmeaRowNo('1.2.3.4.5').failureBlockKey, '1.2.3')
assert.equal(parsePfmeaRowNo('1.2.3'), null)
assertJsonEqual(parsePfmeaRowNoParts('10.2.3.4.5'), [10, 2, 3, 4, 5])
assert.equal(parsePfmeaRowNoParts('10.2.x.4.5'), null)
assert.equal(samePfmeaGroupValue(' a ', 'a'), true)
assert.equal(samePfmeaGroupValue(null, 'a'), false)

const deterministicA = createDeterministicPfmeaGroupId('seed')
const deterministicB = createDeterministicPfmeaGroupId('seed')
assert.equal(deterministicA, deterministicB)
assert.match(deterministicA, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

const rows = [
  {
    id: 'r1',
    operation_id: 'op1',
    failure_mode_group_id: 'fm-a',
    failure_block_group_id: 'fb-a',
    action_plan_group_id: 'cause-a',
    operations: { id: 'op1', operation_number: 10 },
  },
  {
    id: 'r2',
    operation_id: 'op1',
    failure_mode_group_id: 'fm-a',
    failure_block_group_id: 'fb-a',
    action_plan_group_id: 'cause-a',
    operations: { id: 'op1', operation_number: 10 },
  },
  {
    id: 'r3',
    operation_id: 'op1',
    failure_mode_group_id: 'fm-a',
    failure_block_group_id: 'fb-b',
    action_plan_group_id: 'cause-b',
    operations: { id: 'op1', operation_number: 10 },
  },
]

const hierarchy = buildPfmeaHierarchy(rows)
assertJsonEqual(
  hierarchy.map((item) => item.rowLabel),
  ['10.1.1.1.1', '10.1.1.1.2', '10.1.2.1.1']
)
assertJsonEqual(
  buildPfmeaBlockMergeInfoByHierarchy(rows, hierarchy, (item) => item.failureBlockKey),
  [
    { span: 2, end: 1 },
    { span: 0, end: 1 },
    { span: 1, end: 2 },
  ]
)

const derived = derivePfmeaGroupIds({ id: 'row-a', operation_id: 'op-a', row_no: '1.1.1.1.1' })
assert.equal(derived.failure_mode_group_id, derivePfmeaGroupIds({ id: 'row-a', operation_id: 'op-a', row_no: '1.1.1.1.1' }).failure_mode_group_id)

console.log('pfmea hierarchy utils smoke passed')

