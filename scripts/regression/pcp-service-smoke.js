const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function loadTypeScriptModule(relativePath, moduleMap = {}) {
  const sourcePath = path.join(__dirname, '..', '..', ...relativePath)
  const source = fs.readFileSync(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(moduleMap, request)) return moduleMap[request]
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const pcpUtils = loadTypeScriptModule(['src', 'features', 'pcp', 'pcp-utils.ts'])
const {
  fetchPcpEditSession,
  fetchPcpRowsForRevision,
  fetchPcpSelectionThreshold,
  hydratePcpDraftRows,
  insertPcpRow,
} = loadTypeScriptModule(['src', 'features', 'pcp', 'pcp-service.ts'], {
  './pcp-utils': pcpUtils,
})

function createBuilder(table, resolveResponse, calls) {
  const state = {
    countOptions: null,
    filters: [],
    insertPayload: null,
    limitCount: null,
    orders: [],
    selected: null,
    table,
    terminal: null,
  }

  const builder = {
    eq(column, value) {
      state.filters.push({ column, op: 'eq', value })
      return builder
    },
    in(column, value) {
      state.filters.push({ column, op: 'in', value })
      return builder
    },
    insert(payload) {
      state.insertPayload = payload
      return builder
    },
    limit(count) {
      state.limitCount = count
      return builder
    },
    maybeSingle() {
      state.terminal = 'maybeSingle'
      calls.push(state)
      return Promise.resolve(resolveResponse(state))
    },
    order(column, options) {
      state.orders.push({ column, options })
      return builder
    },
    select(columns, options) {
      state.selected = columns
      state.countOptions = options ?? null
      return builder
    },
    single() {
      state.terminal = 'single'
      calls.push(state)
      return Promise.resolve(resolveResponse(state))
    },
    then(onFulfilled, onRejected) {
      calls.push(state)
      return Promise.resolve(resolveResponse(state)).then(onFulfilled, onRejected)
    },
    update(payload) {
      state.updatePayload = payload
      return builder
    },
  }

  return builder
}

function createSupabase(responder) {
  const calls = []
  return {
    calls,
    from(table) {
      return createBuilder(table, (state) => responder(state), calls)
    },
  }
}

async function main() {
  {
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'risk_matrix_config')
      assert.equal(state.filters[0].column, 'project_id')
      assert.equal(state.filters[0].op, 'in')
      assert.equal(state.filters[0].value[0], 'project-1')
      assert.equal(state.filters[0].value[1], '00000000-0000-0000-0000-000000000000')
      return {
        data: [
          { project_id: '00000000-0000-0000-0000-000000000000', rpn_yellow_max: 144 },
          { project_id: 'project-1', rpn_yellow_max: 196 },
        ],
        error: null,
      }
    })
    assert.equal(await fetchPcpSelectionThreshold(supabase, 'project-1'), 196)
  }

  {
    const supabase = createSupabase(() => ({
      data: {
        project_id: 'project-1',
        locked_by: 'user-1',
        started_at: '2026-05-03T08:00:00.000Z',
        last_activity_at: '2026-05-03T08:30:00.000Z',
      },
      error: null,
    }))
    const session = await fetchPcpEditSession(supabase, 'project-1')
    assert.equal(session.projectId, 'project-1')
    assert.equal(session.lockedBy, 'user-1')
    assert.equal(session.startedAt, '2026-05-03T08:00:00.000Z')
    assert.equal(session.lastActivityAt, '2026-05-03T08:30:00.000Z')
  }

  {
    const supabase = createSupabase(() => ({
      data: [{
        id: 'pcp-1',
        revision_id: 'rev-1',
        operation_id: 'op-1',
        pfmea_row_id: 'pfmea-1',
        failure_mode: 'Leak',
        characteristic: 'Torque',
        class: 'SC',
        current_prevention: 'Standard work',
        current_detection: 'Final check',
        control_method: 'Gauge',
        sample_size: '1',
        frequency: 'Each',
        reaction_plan: 'Stop',
        source: 'PFMEA',
        status: 'OPEN',
        created_at: '2026-05-03T08:00:00.000Z',
        updated_at: '2026-05-03T08:00:00.000Z',
        operations: [{ id: 'op-1', project_id: 'project-1', operation_number: 10, name: 'Assembly' }],
      }],
      error: null,
    }))
    const rows = await fetchPcpRowsForRevision(supabase, 'project-1', 'rev-1')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].operations.id, 'op-1')
  }

  {
    let inserted = null
    const supabase = createSupabase((state) => {
      if (state.countOptions?.head) return { count: 0, data: null, error: null }
      if (state.insertPayload) {
        inserted = state.insertPayload
        return { data: null, error: null }
      }
      return {
        data: [{
          operation_id: 'op-1',
          revision_id: 'open-rev',
          failure_mode: null,
          characteristic: 'Width',
          class: 'critical characteristic',
          source: '',
          status: '',
        }],
        error: null,
      }
    })
    await hydratePcpDraftRows(supabase, 'draft-rev', 'open-rev')
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].revision_id, 'draft-rev')
    assert.equal(inserted[0].class, 'CC')
    assert.equal(inserted[0].source, 'MANUAL')
    assert.equal(inserted[0].status, 'OPEN')
  }

  {
    const supabase = createSupabase((state) => {
      assert.equal(state.insertPayload[0].class, 'SC')
      assert.equal(state.insertPayload[0].source, 'MANUAL')
      return {
        data: {
          id: 'new-pcp-row',
          created_at: '2026-05-03T09:00:00.000Z',
          updated_at: '2026-05-03T09:00:00.000Z',
        },
        error: null,
      }
    })
    const created = await insertPcpRow(supabase, {
      operation_id: 'op-1',
      revision_id: 'draft-rev',
      characteristic: 'Torque',
      class: 'special characteristic',
    })
    assert.equal(created.id, 'new-pcp-row')
  }

  console.log('pcp service smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
