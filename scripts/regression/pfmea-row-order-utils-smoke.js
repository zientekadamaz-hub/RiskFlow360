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
    Date,
    exports: {},
    module: { exports: {} },
    require: (request) => {
      if (request === './pfmea-hierarchy-utils') {
        return loadModule(['src', 'features', 'pfmea', 'pfmea-hierarchy-utils.ts'])
      }
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const {
  applyPersistedPfmeaRowOrderUpdates,
  buildPfmeaCreatedAtOrder,
  buildPfmeaRowsWithOrderMetadata,
  buildPfmeaRowsWithStableOrderMetadata,
  getPfmeaRowOperationId,
  getPfmeaRowOperationIds,
  insertPfmeaRowAfterAnchor,
  insertPfmeaRowAfterAnchorWithFallback,
  insertPfmeaRowAfterAnchorWithOrderMetadata,
  insertPfmeaRowAtSortIndex,
  reindexPfmeaRows,
  sortPfmeaRows,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-row-order-utils.ts'])

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

const rows = [
  { id: 'b', operation_id: 'op2', row_no: '20.1.1.1.1', __sortIndex: 9, operations: { id: 'op2', operation_number: 20 } },
  { id: 'a', operation_id: 'op1', row_no: '10.1.1.1.1', operations: { id: 'op1', operation_number: 10 } },
  { id: 'c', operation_id: 'op1', row_no: '10.1.1.1.2', operations: { id: 'op1', operation_number: 10 } },
]

assertJsonEqual(
  reindexPfmeaRows(rows).map((row) => row.__sortIndex),
  [0, 1, 2]
)
assertJsonEqual(
  insertPfmeaRowAfterAnchor(rows, 'a', { id: 'x', operation_id: 'op1', operations: { id: 'op1', operation_number: 10 } }).map((row) => row.id),
  ['b', 'a', 'x', 'c']
)
assertJsonEqual(
  insertPfmeaRowAfterAnchorWithFallback(
    [{ id: 'open-a', operation_id: 'op1', operations: { id: 'op1', operation_number: 10 } }],
    [
      { id: 'draft-a', operation_id: 'op1', operations: { id: 'op1', operation_number: 10 } },
      { id: 'draft-b', operation_id: 'op1', operations: { id: 'op1', operation_number: 10 } },
    ],
    'draft-a',
    { id: 'draft-x', operation_id: 'op1', operations: { id: 'op1', operation_number: 10 } }
  ).map((row) => row.id),
  ['draft-a', 'draft-x', 'draft-b']
)
assertJsonEqual(
  insertPfmeaRowAtSortIndex(rows, { id: 'y', operation_id: 'op1', operations: { id: 'op1', operation_number: 10 } }, 1).map((row) => row.id),
  ['b', 'y', 'a', 'c']
)
assertJsonEqual(
  sortPfmeaRows(rows).map((row) => row.id),
  ['a', 'c', 'b']
)
assert.equal(getPfmeaRowOperationId({ operation_id: '', operations: { id: 'op-from-rel' } }), 'op-from-rel')
assertJsonEqual(getPfmeaRowOperationIds(rows), ['op2', 'op1'])

const originalDateNow = Date.now
Date.now = () => Date.parse('2026-05-02T12:00:00.000Z')
try {
  const order = buildPfmeaCreatedAtOrder(sortPfmeaRows(rows))
  assertJsonEqual(
    order.map((row) => row.row_no),
    ['10.1.1.1.1', '10.1.1.1.2', '20.1.1.1.1']
  )
  assertJsonEqual(
    order.map((row) => row.created_at),
    ['2026-05-02T11:59:59.998Z', '2026-05-02T11:59:59.999Z', '2026-05-02T12:00:00.000Z']
  )

  const withMetadata = buildPfmeaRowsWithOrderMetadata(rows)
  assertJsonEqual(
    withMetadata.orderedRows.map((row) => [row.id, row.__sortIndex]),
    [
      ['a', 0],
      ['c', 1],
      ['b', 2],
    ]
  )

  const insertedWithVisibleOrder = insertPfmeaRowAfterAnchorWithOrderMetadata(
    [
      { id: 'visible-a', operation_id: 'op1', row_no: '10.1.3.1.1', operations: { id: 'op1', operation_number: 10 } },
      { id: 'visible-b', operation_id: 'op1', row_no: '10.1.1.1.1', operations: { id: 'op1', operation_number: 10 } },
      { id: 'visible-c', operation_id: 'op1', row_no: '10.1.2.1.1', operations: { id: 'op1', operation_number: 10 } },
    ],
    [
      { id: 'visible-a', operation_id: 'op1', row_no: '10.1.3.1.1', operations: { id: 'op1', operation_number: 10 } },
      { id: 'visible-c', operation_id: 'op1', row_no: '10.1.2.1.1', operations: { id: 'op1', operation_number: 10 } },
      { id: 'visible-b', operation_id: 'op1', row_no: '10.1.1.1.1', operations: { id: 'op1', operation_number: 10 } },
    ],
    'visible-b',
    { id: 'visible-x', operation_id: 'op1', operations: { id: 'op1', operation_number: 10 } }
  )
  assertJsonEqual(
    insertedWithVisibleOrder.orderedRows.map((row) => row.id),
    ['visible-a', 'visible-b', 'visible-x', 'visible-c']
  )
  assertJsonEqual(
    insertedWithVisibleOrder.orderedRows.map((row) => row.row_no),
    ['10.1.1.1.1', '10.2.1.1.1', '10.3.1.1.1', '10.4.1.1.1']
  )

  const stable = buildPfmeaRowsWithStableOrderMetadata([
    {
      ...rows[0],
      action_plan_group_id: 'ap-b',
      created_at: '2026-04-01T00:00:00.000Z',
      failure_block_group_id: 'fb-b',
      failure_mode_group_id: 'fm-b',
    },
    {
      ...rows[1],
      action_plan_group_id: 'ap-a',
      created_at: '2026-04-01T00:00:01.000Z',
      failure_block_group_id: 'fb-a',
      failure_mode_group_id: 'fm-a',
    },
    {
      ...rows[2],
      action_plan_group_id: 'ap-c',
      created_at: '2026-04-01T00:00:02.000Z',
      failure_block_group_id: 'fb-c',
      failure_mode_group_id: 'fm-c',
    },
  ])
  assertJsonEqual(
    stable.orderedRows.map((row) => [row.id, row.created_at]),
    [
      ['a', '2026-04-01T00:00:01.000Z'],
      ['c', '2026-04-01T00:00:02.000Z'],
      ['b', '2026-04-01T00:00:00.000Z'],
    ]
  )
  assertJsonEqual(
    stable.updates.map((row) => [row.id, row.row_no, row.failure_mode_group_id, row.failure_block_group_id, row.action_plan_group_id]),
    [
      ['a', '10.1.1.1.1', 'fm-a', 'fb-a', 'ap-a'],
      ['c', '10.1.1.1.2', 'fm-c', 'fb-c', 'ap-c'],
      ['b', '20.1.1.1.1', 'fm-b', 'fb-b', 'ap-b'],
    ]
  )

  const updatedRows = applyPersistedPfmeaRowOrderUpdates(stable.orderedRows, [
    {
      id: 'c',
      created_at: '2026-05-01T00:00:00.000Z',
      row_no: '10.1.1.1.2',
      failure_mode_group_id: 'fm-c-new',
      failure_block_group_id: 'fb-c-new',
      action_plan_group_id: 'ap-c-new',
    },
  ])
  assert.notEqual(updatedRows, stable.orderedRows)
  assertJsonEqual(
    updatedRows.map((row) => [row.id, row.created_at, row.failure_mode_group_id, row.failure_block_group_id, row.action_plan_group_id]),
    [
      ['a', '2026-04-01T00:00:01.000Z', 'fm-a', 'fb-a', 'ap-a'],
      ['c', '2026-05-01T00:00:00.000Z', 'fm-c-new', 'fb-c-new', 'ap-c-new'],
      ['b', '2026-04-01T00:00:00.000Z', 'fm-b', 'fb-b', 'ap-b'],
    ]
  )

  const unchangedRows = applyPersistedPfmeaRowOrderUpdates(updatedRows, [
    {
      id: 'c',
      created_at: '2026-05-01T00:00:00.000Z',
      row_no: '10.1.1.1.2',
      failure_mode_group_id: 'fm-c-new',
      failure_block_group_id: 'fb-c-new',
      action_plan_group_id: 'ap-c-new',
    },
  ])
  assert.equal(unchangedRows, updatedRows)
} finally {
  Date.now = originalDateNow
}

console.log('pfmea row order utils smoke passed')
