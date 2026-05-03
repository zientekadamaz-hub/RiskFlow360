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

function createBuilder(table, resolveResponse, calls) {
  const state = {
    filters: [],
    insertPayload: null,
    selected: null,
    table,
    terminal: null,
    upsertOptions: null,
    upsertPayload: null,
  }

  const builder = {
    delete() {
      state.delete = true
      return builder
    },
    eq(column, value) {
      state.filters.push({ column, op: 'eq', value })
      return builder
    },
    insert(payload) {
      state.insertPayload = payload
      return builder
    },
    maybeSingle() {
      state.terminal = 'maybeSingle'
      calls.push(state)
      return Promise.resolve(resolveResponse(state))
    },
    neq(column, value) {
      state.filters.push({ column, op: 'neq', value })
      return builder
    },
    order(column, options) {
      state.order = { column, options }
      return builder
    },
    select(columns) {
      state.selected = columns
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
    upsert(payload, options) {
      state.upsertPayload = payload
      state.upsertOptions = options ?? null
      return builder
    },
  }

  return builder
}

function createSupabase(responder, options = {}) {
  const calls = []
  return {
    auth: {
      getSession: async () => ({
        data: { session: options.session ?? null },
      }),
      getUser: async () => ({
        data: { user: options.user ?? null },
      }),
    },
    calls,
    from(table) {
      return createBuilder(table, (state) => responder(state), calls)
    },
    rpc(name) {
      return {
        maybeSingle: async () => {
          calls.push({ rpc: name, terminal: 'maybeSingle' })
          return options.rpc?.[name] ?? { data: null, error: null }
        },
      }
    },
  }
}

async function main() {
  let accessMode = 'none'
  const customerAccess = {
    hasCustomerModuleAccess: (_accessMap, _projectId, module) => accessMode === 'both' || (accessMode === 'pfd' && module === 'PFD'),
    loadOwnCustomerAccessMap: async () => ({}),
  }

  const {
    fetchPfdCanvasData,
    fetchPfdModuleAccess,
    startPfdEditSession,
  } = loadTypeScriptModule(['src', 'features', 'pfd', 'pfd-service.ts'], {
    '@/lib/customer-access': customerAccess,
  })

  {
    const supabase = createSupabase(() => ({ data: null, error: null }), {
      rpc: { get_my_header: { data: { org_role: 'engineer' }, error: null } },
      session: { user: { id: 'user-1' } },
    })
    const access = await fetchPfdModuleAccess(supabase, 'project-1')
    assert.equal(access.state, 'allowed')
    assert.equal(access.canOpenPfmeaPanel, true)
    assert.equal(access.redirectToProjects, false)
  }

  {
    accessMode = 'pfd'
    const supabase = createSupabase(() => ({ data: null, error: null }), {
      rpc: { get_my_header: { data: { org_role: 'customer' }, error: null } },
      session: { user: { id: 'customer-1' } },
    })
    const access = await fetchPfdModuleAccess(supabase, 'project-1')
    assert.equal(access.state, 'allowed')
    assert.equal(access.canOpenPfmeaPanel, false)
    assert.equal(access.redirectToProjects, false)
  }

  {
    accessMode = 'none'
    const supabase = createSupabase(() => ({ data: null, error: null }), {
      rpc: { get_my_header: { data: { org_role: 'customer' }, error: null } },
      session: { user: { id: 'customer-1' } },
    })
    const access = await fetchPfdModuleAccess(supabase, 'project-1')
    assert.equal(access.state, 'denied')
    assert.equal(access.redirectToProjects, true)
  }

  {
    const nowMs = new Date('2026-05-03T10:00:00.000Z').getTime()
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'pfd_edit_sessions')
      return {
        data: {
          locked_by: 'other-user',
          last_activity_at: '2026-05-03T09:59:00.000Z',
        },
        error: null,
      }
    })
    const result = await startPfdEditSession(supabase, {
      currentUserId: 'user-1',
      edges: [],
      editLockMs: 48 * 60 * 60 * 1000,
      nodes: [],
      nowMs,
      projectId: 'project-1',
    })
    assert.equal(result.blocked, true)
    assert.equal(result.message, 'This PFD is currently locked by another user.')
  }

  {
    const supabase = createSupabase((state) => {
      if (state.table === 'pfd_diagrams') return { data: null, error: null }
      if (state.table === 'operations' && state.insertPayload) {
        return {
          data: {
            active: true,
            id: 'op-1',
            machine: '',
            name: '',
            operation: '',
            operation_number: 10,
            project_id: 'project-1',
          },
          error: null,
        }
      }
      if (state.table === 'operations') return { data: [], error: null }
      return { data: null, error: null }
    })
    const data = await fetchPfdCanvasData(supabase, 'project-1')
    assert.equal(data.diagram, null)
    assert.equal(data.operations.length, 1)
    assert.equal(data.operations[0].id, 'op-1')
  }

  console.log('pfd service smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
