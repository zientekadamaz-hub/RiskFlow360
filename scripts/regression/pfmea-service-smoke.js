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
    limitCount: null,
    orderBy: [],
    selected: null,
    table,
    terminal: null,
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
      state.orderBy.push({ column, options })
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

const displayUtils = loadTypeScriptModule(['src', 'features', 'pfmea', 'pfmea-display-utils.ts'])
const {
  deletePfmeaEditSession,
  deletePfmeaRowsByRevision,
  fetchPfmeaAuthorName,
  fetchPfmeaCurrentDraftRevisionId,
  fetchPfmeaEditSession,
  fetchPfmeaProjectRole,
  fetchPfmeaProjectView,
  fetchPfmeaRevisionHistory,
} = loadTypeScriptModule(['src', 'features', 'pfmea', 'pfmea-service.ts'], {
  './pfmea-display-utils': displayUtils,
})

async function main() {
  {
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'profiles')
      return { data: { first_name: 'Oliwia', last_name: 'Zientek' }, error: null }
    })
    assert.equal(await fetchPfmeaAuthorName(supabase, 'user-1'), 'Oliwia Zientek')
  }

  {
    const supabase = createSupabase((state) => {
      if (state.table === 'projects') return { data: { organization_id: 'org-1' }, error: null }
      if (state.table === 'organization_members') return { data: { role: 'Champion' }, error: null }
      return { data: null, error: null }
    })
    assert.equal(await fetchPfmeaProjectRole(supabase, 'project-1', 'user-1'), 'Champion')
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
    const session = await fetchPfmeaEditSession(supabase, 'project-1')
    assert.equal(session.projectId, 'project-1')
    assert.equal(session.lockedBy, 'user-1')
    assert.equal(session.startedAt, '2026-05-03T08:00:00.000Z')
    assert.equal(session.lastActivityAt, '2026-05-03T08:30:00.000Z')
  }

  {
    const supabase = createSupabase(() => ({
      data: {
        current_draft_revision_id: 'draft-rev',
        current_open_revision_id: 'open-rev',
        draft_revision_label: '1.0.0',
        id: 'project-1',
        name: 'Insulation Potting',
        open_revision_label: '1.0.0',
        standard: 'GENERIC',
        status: 'OPEN',
      },
      error: null,
    }))
    const project = await fetchPfmeaProjectView(supabase, 'project-1')
    assert.equal(project.name, 'Insulation Potting')
    assert.equal(project.current_open_revision_id, 'open-rev')
  }

  {
    const supabase = createSupabase(() => ({
      data: { current_draft_revision_id: 'draft-rev' },
      error: null,
    }))
    assert.equal(await fetchPfmeaCurrentDraftRevisionId(supabase, 'project-1'), 'draft-rev')
  }

  {
    const supabase = createSupabase(() => ({
      data: [{
        author_name: 'Adam',
        avg_rpn: '144.4',
        change_description: 'Published update',
        created_at: '2026-05-03T08:00:00.000Z',
        id: 'h-1',
        revision_label: '2.1.0',
        risk_count: 5,
      }],
      error: null,
    }))
    const history = await fetchPfmeaRevisionHistory(supabase, 'project-1')
    assert.equal(history.length, 1)
    assert.equal(history[0].revisionLabel, '2.1.0')
    assert.equal(history[0].avgRpn, 144.4)
  }

  {
    const deleted = []
    const supabase = createSupabase((state) => {
      if (state.delete) deleted.push(`${state.table}:${state.filters.map((filter) => `${filter.column}=${filter.value}`).join(',')}`)
      return { data: null, error: null }
    })
    await deletePfmeaRowsByRevision(supabase, 'draft-rev')
    await deletePfmeaEditSession(supabase, 'project-1', 'user-1')
    assert.equal(deleted[0], 'pfmea_rows:revision_id=draft-rev')
    assert.equal(deleted[1], 'pfmea_edit_sessions:project_id=project-1,locked_by=user-1')
  }

  console.log('pfmea service smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
