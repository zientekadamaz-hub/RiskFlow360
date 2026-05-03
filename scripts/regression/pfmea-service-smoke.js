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
    inFilters: [],
    insertPayload: null,
    limitCount: null,
    orderBy: [],
    selected: null,
    table,
    terminal: null,
    updatePayload: null,
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
    limit(count) {
      state.limitCount = count
      return builder
    },
    in(column, values) {
      state.inFilters.push({ column, values })
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
    calls,
    from(table) {
      return createBuilder(table, (state) => responder(state), calls)
    },
    rpc(name, params) {
      calls.push({ params, rpc: name })
      return Promise.resolve(options.rpc?.[name] ?? { data: null, error: null })
    },
  }
}

const displayUtils = loadTypeScriptModule(['src', 'features', 'pfmea', 'pfmea-display-utils.ts'])
const publishUtils = loadTypeScriptModule(['src', 'features', 'pfmea', 'pfmea-publish-utils.ts'])
const payloadUtils = {
  PFMEA_SELECT_FIELDS: 'modern-fields',
  PFMEA_SELECT_FIELDS_LEGACY: 'legacy-fields',
  buildPfmeaInsertPayloadForRevision(row, revisionId) {
    return {
      revision_id: revisionId,
      operation_id: row.operation_id,
      row_no: row.row_no ?? null,
      failure_mode_group_id: row.failure_mode_group_id ?? null,
    }
  },
  buildPfmeaPublishedSyncPatch(row) {
    return {
      failure_mode: row.failure_mode ?? '',
      failure_mode_group_id: row.failure_mode_group_id ?? null,
      rpn: row.rpn ?? null,
    }
  },
  isMissingPfmeaGroupIdColumnError(error) {
    return String(error?.message ?? '').toLowerCase().includes('failure_mode_group_id')
  },
  stripPfmeaGroupIdsFromPayload(payload) {
    const next = { ...payload }
    delete next.failure_mode_group_id
    return next
  },
}
const hierarchyUtils = {
  isPlaceholderRowId(id) {
    return String(id ?? '').startsWith('__')
  },
}
const rowOrderUtils = {
  getPfmeaRowOperationIds(rows) {
    return Array.from(new Set(rows.map((row) => row.operation_id).filter(Boolean)))
  },
  sortPfmeaRows(rows) {
    return [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  },
}
const {
  deletePfmeaEditSession,
  deletePfmeaRowsByRevision,
  fetchPfmeaAuthorName,
  fetchPfmeaCurrentDraftRevisionId,
  fetchPfmeaEditSession,
  fetchPfmeaProjectRole,
  fetchPfmeaProjectView,
  fetchPfmeaRowsForRevision,
  fetchPfmeaRevisionHistory,
  persistPfmeaDirtyRevisionRows,
  persistPfmeaRowOrderMetadata,
  publishPfmeaRevisionWithHistory,
  restorePfmeaRowsSnapshotToRevision,
  startPfmeaEditSession,
} = loadTypeScriptModule(['src', 'features', 'pfmea', 'pfmea-service.ts'], {
  './pfmea-display-utils': displayUtils,
  './pfmea-hierarchy-utils': hierarchyUtils,
  './pfmea-payload-utils': payloadUtils,
  './pfmea-publish-utils': publishUtils,
  './pfmea-row-order-utils': rowOrderUtils,
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
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'pfmea_rows')
      assert.equal(state.selected, 'modern-fields')
      assert.equal(state.filters[0].column, 'revision_id')
      assert.equal(state.filters[0].value, 'rev-1')
      assert.equal(JSON.stringify(state.inFilters[0]), JSON.stringify({ column: 'operation_id', values: ['op-1', 'op-2'] }))
      assert.equal(state.orderBy.length, 3)
      return {
        data: [{ id: 'row-1', revision_id: 'rev-1', operation_id: 'op-1', created_at: '2026-05-03T08:00:00.000Z' }],
        error: null,
      }
    })
    const result = await fetchPfmeaRowsForRevision(supabase, {
      groupIdsSupported: true,
      operationIds: ['op-1', 'op-2', 'op-1', ''],
      revisionId: 'rev-1',
    })
    assert.equal(result.groupIdsSupported, true)
    assert.equal(result.rows.length, 1)
  }

  {
    let callCount = 0
    const supabase = createSupabase((state) => {
      callCount += 1
      if (callCount === 1) {
        assert.equal(state.selected, 'modern-fields')
        return { data: null, error: { message: 'column pfmea_rows.failure_mode_group_id does not exist' } }
      }
      assert.equal(state.selected, 'legacy-fields')
      return {
        data: [{ id: 'row-legacy', revision_id: 'rev-1', operation_id: 'op-1', created_at: '2026-05-03T08:00:00.000Z' }],
        error: null,
      }
    })
    const result = await fetchPfmeaRowsForRevision(supabase, {
      groupIdsSupported: true,
      revisionId: 'rev-1',
    })
    assert.equal(result.groupIdsSupported, false)
    assert.equal(result.rows[0].id, 'row-legacy')
  }

  {
    const inserts = []
    const deletes = []
    const supabase = createSupabase((state) => {
      if (state.delete) {
        deletes.push(state)
        return { data: null, error: null }
      }
      if (state.insertPayload) {
        inserts.push(state.insertPayload)
        return { data: null, error: null }
      }
      return {
        data: [{ id: 'row-1', revision_id: 'rev-2', operation_id: 'op-1', created_at: '2026-05-03T08:00:00.000Z' }],
        error: null,
      }
    })
    const result = await restorePfmeaRowsSnapshotToRevision(supabase, {
      batchSize: 1,
      groupIdsSupported: false,
      revisionId: 'rev-2',
      sourceRows: [
        { id: '__placeholder', operation_id: 'op-ignored', created_at: '2026-05-03T08:00:00.000Z' },
        { id: 'row-1', operation_id: 'op-1', row_no: '1', failure_mode_group_id: 'fm-1', created_at: '2026-05-03T08:00:00.000Z' },
      ],
    })
    assert.equal(deletes.length, 1)
    assert.equal(JSON.stringify(deletes[0].inFilters[0]), JSON.stringify({ column: 'operation_id', values: ['op-1'] }))
    assert.equal(inserts.length, 1)
    assert.equal(Object.prototype.hasOwnProperty.call(inserts[0][0], 'failure_mode_group_id'), false)
    assert.equal(result.rows.length, 1)
  }

  {
    const updates = []
    const supabase = createSupabase((state) => {
      if (state.updatePayload) updates.push(state)
      return state.terminal === 'maybeSingle'
        ? { data: { id: state.filters.find((filter) => filter.column === 'id')?.value }, error: null }
        : { data: null, error: null }
    })
    const updatedCount = await persistPfmeaDirtyRevisionRows(supabase, {
      dirtyIds: ['source-1'],
      groupIdsSupported: false,
      mappedRows: [
        { id: 'mapped-1', operation_id: 'op-1', failure_mode: 'Mode', failure_mode_group_id: 'fm-1', created_at: '2026-05-03T08:00:00.000Z' },
      ],
      revisionId: 'rev-3',
      sourceRows: [
        { id: 'source-1', operation_id: 'op-1', failure_mode: 'Mode', failure_mode_group_id: 'fm-1', created_at: '2026-05-03T08:00:00.000Z' },
      ],
    })
    assert.equal(updatedCount, 1)
    assert.equal(updates.length, 1)
    assert.equal(Object.prototype.hasOwnProperty.call(updates[0].updatePayload, 'failure_mode_group_id'), false)
  }

  {
    const updates = []
    const supabase = createSupabase((state) => {
      if (state.updatePayload) updates.push(state)
      return { data: null, error: null }
    })
    const persistedUpdates = await persistPfmeaRowOrderMetadata(supabase, {
      groupIdsSupported: true,
      preparedUpdates: [{
        action_plan_group_id: 'ap-1',
        created_at: '2026-05-03T08:01:00.000Z',
        failure_block_group_id: 'fb-1',
        failure_mode_group_id: 'fm-1',
        id: 'row-1',
        row_no: '1',
      }],
      revisionId: 'rev-4',
      sourceRows: [{
        action_plan_group_id: null,
        created_at: '2026-05-03T08:00:00.000Z',
        failure_block_group_id: null,
        failure_mode_group_id: null,
        id: 'row-1',
        operation_id: 'op-1',
        revision_id: 'rev-4',
        row_no: null,
      }],
    })
    assert.equal(persistedUpdates.length, 1)
    assert.equal(updates.length, 1)
    assert.equal(updates[0].updatePayload.row_no, '1')
    assert.equal(updates[0].filters.some((filter) => filter.column === 'revision_id' && filter.value === 'rev-4'), true)
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
    const supabase = createSupabase(() => ({ data: null, error: null }), {
      rpc: {
        publish_pfmea_revision_with_history: {
          data: { revision_id: 'rev-published', revision_label: '2.0.0' },
          error: null,
        },
      },
    })
    const result = await publishPfmeaRevisionWithHistory(supabase, {
      authorName: 'Adam',
      avgRpn: 144,
      changeDescription: 'Publish',
      projectId: 'project-1',
      riskCount: 5,
      userId: 'user-1',
    })
    assert.equal(result.historyAlreadyInserted, true)
    assert.equal(result.usedFallback, false)
    assert.equal(result.data.revision_id, 'rev-published')
    assert.equal(supabase.calls.some((call) => call.rpc === 'publish_pfmea_revision_with_history'), true)
  }

  {
    const supabase = createSupabase(() => ({ data: null, error: null }), {
      rpc: {
        publish_pfmea_revision_with_history: {
          data: null,
          error: { code: 'PGRST202', message: 'Function not found' },
        },
        publish_process_module_revision: {
          data: 'fallback-rev',
          error: null,
        },
      },
    })
    const result = await publishPfmeaRevisionWithHistory(supabase, {
      authorName: 'Adam',
      avgRpn: null,
      changeDescription: 'Publish',
      projectId: 'project-1',
      riskCount: 5,
      userId: 'user-1',
    })
    assert.equal(result.historyAlreadyInserted, false)
    assert.equal(result.usedFallback, true)
    assert.equal(result.data, 'fallback-rev')
    assert.equal(supabase.calls.some((call) => call.rpc === 'publish_process_module_revision'), true)
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

  {
    const nowMs = new Date('2026-05-03T10:00:00.000Z').getTime()
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'pfmea_edit_sessions')
      return {
        data: {
          locked_by: 'other-user',
          last_activity_at: '2026-05-03T09:59:00.000Z',
        },
        error: null,
      }
    })
    const result = await startPfmeaEditSession(supabase, {
      editLockMs: 48 * 60 * 60 * 1000,
      hasExistingDraftRevision: false,
      isChampion: false,
      nowMs,
      projectId: 'project-1',
      userId: 'user-1',
    })
    assert.equal(result.blocked, true)
    assert.equal(result.message, 'This PFMEA is currently locked by another user.')
  }

  {
    const calls = []
    const supabase = createSupabase((state) => {
      calls.push(state)
      if (state.table === 'pfmea_edit_sessions' && state.upsertPayload) return { data: null, error: null }
      if (state.table === 'pfmea_edit_sessions') return { data: null, error: null }
      if (state.table === 'projects_with_revision') {
        return {
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
        }
      }
      return { data: null, error: null }
    }, {
      rpc: {
        ensure_process_draft: { data: 'draft-rev-from-rpc', error: null },
      },
    })
    const result = await startPfmeaEditSession(supabase, {
      editLockMs: 48 * 60 * 60 * 1000,
      hasExistingDraftRevision: false,
      isChampion: false,
      nowIso: '2026-05-03T10:00:00.000Z',
      nowMs: new Date('2026-05-03T10:00:00.000Z').getTime(),
      projectId: 'project-1',
      userId: 'user-1',
    })
    assert.equal(result.blocked, false)
    assert.equal(result.draftRevisionId, 'draft-rev')
    assert.equal(result.openRevisionId, 'open-rev')
    assert.equal(result.draftRowsDeleted, false)
    assert.equal(result.shouldRefreshExistingDraftFromOpen, false)
    assert.equal(calls.some((state) => state.table === 'pfmea_edit_sessions' && state.upsertPayload), true)
    assert.equal(supabase.calls.some((call) => call.rpc === 'ensure_process_draft'), true)
  }

  console.log('pfmea service smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
