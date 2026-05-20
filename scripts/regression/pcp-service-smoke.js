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
const riskEngine = loadTypeScriptModule(['src', 'lib', 'risk-engine.ts'])
const {
  computePcpDraftDirtyStateFromRows,
  fetchPcpRiskMatrixContext,
  fetchPcpDraftDirtyState,
  fetchPcpEditSession,
  fetchLatestPcpRevisionIdForPcp,
  fetchPcpRowsForRevision,
  fetchPcpSelectionThreshold,
  getPcpSeedRiskColor,
  hydratePcpDraftRows,
  insertPcpRow,
  preparePcpDraftForPublish,
  resolvePcpRevisionContext,
  updatePcpRow,
} = loadTypeScriptModule(['src', 'features', 'pcp', 'pcp-service.ts'], {
  '@/lib/risk-engine': riskEngine,
  './pcp-utils': pcpUtils,
})

function createBuilder(table, resolveResponse, calls) {
  const state = {
    countOptions: null,
    deleteRequested: false,
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
    delete() {
      state.deleteRequested = true
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
    const supabase = createSupabase((state) => {
      if (state.table === 'projects') {
        return { data: { organization_id: 'org-1' }, error: null }
      }
      if (state.table === 'risk_matrix_config') {
        assert.equal(state.filters[0].column, 'organization_id')
        assert.equal(state.filters[0].value, 'org-1')
        return {
          data: { id: 7, organization_id: 'org-1', mode: 'manual', rpn_green_max: 100, rpn_yellow_max: 200, rpn_orange_max: 360 },
          error: null,
        }
      }
      if (state.table === 'risk_matrix_cells') {
        assert.equal(state.filters[0].column, 'organization_id')
        assert.equal(state.filters[0].value, 'org-1')
        return {
          data: [
            { organization_id: 'org-1', severity: 8, do_value: 18, color: 'yellow' },
            { organization_id: 'org-1', severity: 8, do_value: 25, color: 'orange' },
          ],
          error: null,
        }
      }
      throw new Error(`Unexpected table ${state.table}`)
    })
    const context = await fetchPcpRiskMatrixContext(supabase, 'project-1')
    assert.equal(context.mode, 'manual')
    assert.equal(context.thresholds.yellowMax, 200)
    assert.equal(getPcpSeedRiskColor({ id: 'yellow', operation_id: 'op', pcp: null, failure_mode: null, class: null, characteristic: null, severity: 8, occurrence: 9, detection: 2, rpn: 144, current_prevention: null, current_detection: null }, context), 'yellow')
    assert.equal(getPcpSeedRiskColor({ id: 'orange', operation_id: 'op', pcp: null, failure_mode: null, class: null, characteristic: null, severity: 8, occurrence: 5, detection: 5, rpn: 200, current_prevention: null, current_detection: null }, context), 'orange')
    assert.equal(getPcpSeedRiskColor({ id: 'current-do', operation_id: 'op', pcp: null, failure_mode: null, class: null, characteristic: null, severity: 8, occurrence: 5, detection: 5, oxd_current: 18, rpn: 200, rpn_current: 144, current_prevention: null, current_detection: null }, context), 'yellow')
    assert.equal(getPcpSeedRiskColor({ id: 'current-rpn', operation_id: 'op', pcp: null, failure_mode: null, class: null, characteristic: null, severity: null, occurrence: null, detection: null, rpn: 400, rpn_current: 80, current_prevention: null, current_detection: null }, context), 'green')
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
    assert.equal(JSON.stringify(
      computePcpDraftDirtyStateFromRows(
        [{ id: 'draft-1', risk_uid: 'risk-1', control_method: 'Gauge', sample_size: '5', frequency: 'Each', reaction_plan: 'Stop' }],
        [{ id: 'open-1', risk_uid: 'risk-1', control_method: 'Gauge', sample_size: '5', frequency: 'Each', reaction_plan: 'Stop' }]
      )
    ), JSON.stringify({ differenceCount: 0, isDirty: false })
    )
    assert.equal(JSON.stringify(
      computePcpDraftDirtyStateFromRows(
        [{ id: 'draft-1', risk_uid: 'risk-1', control_method: 'New gauge', sample_size: '5', frequency: 'Each', reaction_plan: 'Stop' }],
        [{ id: 'open-1', risk_uid: 'risk-1', control_method: 'Gauge', sample_size: '5', frequency: 'Each', reaction_plan: 'Stop' }]
      )
    ), JSON.stringify({ differenceCount: 1, isDirty: true })
    )
    assert.equal(JSON.stringify(
      computePcpDraftDirtyStateFromRows(
        [{ id: 'draft-empty-new', risk_uid: 'risk-2', control_method: '', sample_size: '', frequency: '', reaction_plan: '' }],
        []
      )
    ), JSON.stringify({ differenceCount: 0, isDirty: false })
    )
    assert.equal(JSON.stringify(
      computePcpDraftDirtyStateFromRows(
        [{ id: 'draft-new', risk_uid: 'risk-2', control_method: 'Visual', sample_size: '', frequency: '', reaction_plan: '' }],
        []
      )
    ), JSON.stringify({ differenceCount: 1, isDirty: true })
    )
  }

  {
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'control_plan_rows')
      const revisionFilter = state.filters.find((filter) => filter.column === 'revision_id')
      if (revisionFilter?.value === 'draft-rev') {
        return {
          data: [{
            id: 'draft-1',
            revision_id: 'draft-rev',
            risk_uid: 'risk-1',
            operation_id: 'op-1',
            control_method: 'Visual',
            sample_size: '',
            frequency: '',
            reaction_plan: '',
            operations: { id: 'op-1', project_id: 'project-1', operation_number: 10, name: 'Assembly' },
          }],
          error: null,
        }
      }
      if (revisionFilter?.value === 'open-rev') {
        return {
          data: [{
            id: 'open-1',
            revision_id: 'open-rev',
            risk_uid: 'risk-1',
            operation_id: 'op-1',
            control_method: '',
            sample_size: '',
            frequency: '',
            reaction_plan: '',
            operations: { id: 'op-1', project_id: 'project-1', operation_number: 10, name: 'Assembly' },
          }],
          error: null,
        }
      }
      return { data: [], error: null }
    })
    assert.equal(
      JSON.stringify(await fetchPcpDraftDirtyState(supabase, {
        draftRevisionId: 'draft-rev',
        openRevisionId: 'open-rev',
        projectId: 'project-1',
      })),
      JSON.stringify({ differenceCount: 1, isDirty: true })
    )
  }

  {
    const inserted = []
    const supabase = createSupabase((state) => {
      if (state.insertPayload) {
        inserted.push(...state.insertPayload)
        return { data: null, error: null }
      }
      if (state.selected?.startsWith('id,')) return { data: [], error: null }
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
    let inserted = null
    let restoredPatch = null
    const supabase = createSupabase((state) => {
      if (state.updatePayload) {
        restoredPatch = state.updatePayload
        assert.deepEqual(state.filters, [
          { column: 'id', op: 'eq', value: 'draft-empty' },
          { column: 'revision_id', op: 'eq', value: 'draft-rev' },
        ])
        return { data: null, error: null }
      }
      if (state.insertPayload) {
        inserted = state.insertPayload
        return { data: null, error: null }
      }
      if (state.selected?.startsWith('id,')) {
        return {
          data: [{
            id: 'draft-empty',
            operation_id: 'op-1',
            pfmea_row_id: 'pfmea-1',
            failure_mode: 'Leak',
            characteristic: 'Torque',
            class: 'SC',
            current_prevention: 'Standard work',
            current_detection: 'Final check',
            control_method: '',
            sample_size: '',
            frequency: '',
            reaction_plan: '',
          }],
          error: null,
        }
      }
      return {
        data: [
          {
            operation_id: 'op-1',
            pfmea_row_id: 'pfmea-1',
            failure_mode: 'Leak',
            characteristic: 'Torque',
            class: 'SC',
            current_prevention: 'Standard work',
            current_detection: 'Final check',
            control_method: 'Gauge',
            sample_size: '5',
            frequency: 'Each lot',
            reaction_plan: 'Hold batch',
            source: 'MANUAL',
            status: 'OPEN',
          },
          {
            operation_id: 'op-2',
            pfmea_row_id: 'pfmea-2',
            failure_mode: 'Scratch',
            characteristic: 'Surface',
            class: null,
            control_method: 'Visual',
            source: 'MANUAL',
            status: 'OPEN',
          },
        ],
        error: null,
      }
    })
    await hydratePcpDraftRows(supabase, 'draft-rev', 'open-rev')
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].operation_id, 'op-2')
    assert.equal(JSON.stringify(restoredPatch), JSON.stringify({
      control_method: 'Gauge',
      sample_size: '5',
      frequency: 'Each lot',
      reaction_plan: 'Hold batch',
    }))
  }

  {
    let restoredPatch = null
    const supabase = createSupabase((state) => {
      if (state.updatePayload) {
        restoredPatch = state.updatePayload
        assert.deepEqual(state.filters, [
          { column: 'id', op: 'eq', value: 'draft-current-pfmea' },
          { column: 'revision_id', op: 'eq', value: 'draft-rev' },
        ])
        return { data: null, error: null }
      }
      if (state.insertPayload) {
        assert.fail('Risk-context carry-over must restore the matching draft row instead of inserting a duplicate PCP row.')
      }
      if (state.selected?.startsWith('id,')) {
        return {
          data: [{
            id: 'draft-current-pfmea',
            risk_uid: '11111111-1111-4111-8111-111111111111',
            operation_id: 'op-1',
            pfmea_row_id: 'pfmea-new',
            failure_mode: 'Leak',
            characteristic: 'Torque',
            class: 'SC',
            current_prevention: 'New prevention',
            current_detection: 'New detection',
            control_method: '',
            sample_size: '',
            frequency: '',
            reaction_plan: '',
          }],
          error: null,
        }
      }
      return {
        data: [{
          risk_uid: '11111111-1111-4111-8111-111111111111',
          operation_id: 'op-1',
          pfmea_row_id: 'pfmea-old',
          failure_mode: 'Leak',
          characteristic: 'Torque',
          class: 'SC',
          current_prevention: 'Old prevention',
          current_detection: 'Old detection',
          control_method: 'Gauge',
          sample_size: '5',
          frequency: 'Each lot',
          reaction_plan: 'Hold batch',
          source: 'MANUAL',
          status: 'OPEN',
        }],
        error: null,
      }
    })
    await hydratePcpDraftRows(supabase, 'draft-rev', 'open-rev')
    assert.equal(JSON.stringify(restoredPatch), JSON.stringify({
      control_method: 'Gauge',
      sample_size: '5',
      frequency: 'Each lot',
      reaction_plan: 'Hold batch',
    }))
  }

  {
    const inserted = []
    const supabase = createSupabase((state) => {
      if (state.insertPayload) {
        inserted.push(...state.insertPayload)
        return { data: null, error: null }
      }
      if (state.selected?.startsWith('id,')) return { data: [], error: null }
      return {
        data: [{
          operation_id: 'op-1',
          pfmea_row_id: 'pfmea-auto',
          failure_mode: 'Leak',
          characteristic: 'Torque',
          class: 'SC',
          current_prevention: 'Prevention',
          current_detection: 'Detection',
          control_method: 'Gauge',
          sample_size: '5',
          frequency: 'Each lot',
          reaction_plan: 'Hold batch',
          source: 'AUTO',
          status: 'OK',
        }],
        error: null,
      }
    })
    await hydratePcpDraftRows(supabase, 'draft-rev', 'open-rev')
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].source, 'MANUAL')
    assert.equal(inserted[0].characteristic, 'Torque')
  }

  {
    const inserted = []
    const supabase = createSupabase((state) => {
      if (state.insertPayload) {
        inserted.push(...state.insertPayload)
        return { data: null, error: null }
      }
      if (state.selected?.startsWith('id,')) return { data: [], error: null }
      return {
        data: [
          {
            revision_id: 'open-rev',
            risk_uid: '11111111-1111-4111-8111-111111111111',
            operation_id: 'op-1',
            pfmea_row_id: 'pfmea-auto-1',
            failure_mode: 'Leak',
            characteristic: 'Torque',
            class: 'SC',
            source: 'AUTO',
            status: 'OK',
          },
          {
            revision_id: 'open-rev',
            risk_uid: '22222222-2222-4222-8222-222222222222',
            operation_id: 'op-1',
            pfmea_row_id: 'pfmea-auto-2',
            failure_mode: 'Crack',
            characteristic: 'Torque',
            class: 'CC',
            source: 'AUTO',
            status: 'OK',
          },
        ],
        error: null,
      }
    })
    await hydratePcpDraftRows(supabase, 'draft-rev', 'open-rev')
    assert.equal(inserted.length, 2)
    assert.equal(JSON.stringify(inserted.map((row) => row.risk_uid)), JSON.stringify([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]))
  }

  {
    let restoredPatch = null
    const supabase = createSupabase((state) => {
      if (state.updatePayload) {
        restoredPatch = state.updatePayload
        assert.deepEqual(state.filters, [
          { column: 'id', op: 'eq', value: 'draft-auto' },
          { column: 'revision_id', op: 'eq', value: 'draft-rev' },
        ])
        return { data: null, error: null }
      }
      if (state.insertPayload) {
        assert.fail('AUTO PCP carry-over must update the existing operation/characteristic draft row instead of inserting a duplicate.')
      }
      if (state.selected?.startsWith('id,')) {
        return {
          data: [{
            id: 'draft-auto',
            operation_id: 'op-1',
            pfmea_row_id: null,
            failure_mode: '',
            characteristic: 'Torque',
            class: null,
            current_prevention: '',
            current_detection: '',
            control_method: '',
            sample_size: '',
            frequency: '',
            reaction_plan: '',
            source: 'AUTO',
            status: 'REVIEW_REQUIRED',
          }],
          error: null,
        }
      }
      return {
        data: [{
          operation_id: 'op-1',
          pfmea_row_id: 'pfmea-auto',
          failure_mode: 'Leak',
          characteristic: 'Torque',
          class: 'SC',
          current_prevention: 'Prevention',
          current_detection: 'Detection',
          control_method: 'Gauge',
          sample_size: '5',
          frequency: 'Each lot',
          reaction_plan: 'Hold batch',
          source: 'AUTO',
          status: 'OK',
        }],
        error: null,
      }
    })
    await hydratePcpDraftRows(supabase, 'draft-rev', 'open-rev')
    assert.equal(JSON.stringify(restoredPatch), JSON.stringify({
      control_method: 'Gauge',
      sample_size: '5',
      frequency: 'Each lot',
      reaction_plan: 'Hold batch',
      pfmea_row_id: 'pfmea-auto',
      failure_mode: 'Leak',
      class: 'SC',
      current_prevention: 'Prevention',
      current_detection: 'Detection',
    }))
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

  {
    let inserted = false
    let updated = false
    const supabase = createSupabase((state) => {
      if (state.insertPayload) {
        inserted = true
        return { data: null, error: new Error('insert should not run when row exists') }
      }
      if (state.updatePayload) {
        updated = true
        assert.equal(state.updatePayload.control_method, 'Gauge')
        assert.deepEqual(state.filters, [
          { column: 'id', op: 'eq', value: 'existing-pcp-row' },
          { column: 'revision_id', op: 'eq', value: 'draft-rev' },
        ])
        return {
          data: {
            id: 'existing-pcp-row',
            created_at: '2026-05-03T09:00:00.000Z',
            updated_at: '2026-05-03T09:05:00.000Z',
          },
          error: null,
        }
      }
      if (state.table === 'control_plan_rows' && state.selected?.startsWith('id,revision_id')) {
        assert.deepEqual(state.filters, [
          { column: 'revision_id', op: 'eq', value: 'draft-rev' },
          { column: 'risk_uid', op: 'eq', value: '11111111-1111-4111-8111-111111111111' },
        ])
        return {
          data: {
            id: 'existing-pcp-row',
            revision_id: 'draft-rev',
            risk_uid: '11111111-1111-4111-8111-111111111111',
            control_method: '',
            sample_size: '',
            frequency: '',
            reaction_plan: '',
            created_at: '2026-05-03T09:00:00.000Z',
            updated_at: '2026-05-03T09:00:00.000Z',
          },
          error: null,
        }
      }
      return { data: null, error: null }
    })
    const created = await insertPcpRow(supabase, {
      operation_id: 'op-1',
      revision_id: 'draft-rev',
      risk_uid: '11111111-1111-4111-8111-111111111111',
      characteristic: 'Torque',
      control_method: 'Gauge',
    })
    assert.equal(created.id, 'existing-pcp-row')
    assert.equal(inserted, false)
    assert.equal(updated, true)
  }

  {
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'control_plan_rows')
      assert.equal(state.filters[0].column, 'operations.project_id')
      assert.equal(state.filters[0].value, 'project-1')
      return {
        data: [
          { revision_id: 'draft-rev', control_method: 'Draft empty should be excluded' },
          { revision_id: 'open-empty-rev', control_method: '', sample_size: '', frequency: '', reaction_plan: '' },
          { revision_id: 'saved-pcp-rev', control_method: 'Gauge', sample_size: '', frequency: '', reaction_plan: '' },
        ],
        error: null,
      }
    })
    assert.equal(
      await fetchLatestPcpRevisionIdForPcp(supabase, 'project-1', ['draft-rev']),
      'saved-pcp-rev'
    )
  }

  {
    const supabase = createSupabase((state) => {
      assert.equal(state.table, 'control_plan_rows')
      assert.equal(state.updatePayload.control_method, 'Gauge')
      assert.deepEqual(state.filters, [
        { column: 'id', op: 'eq', value: 'pcp-1' },
        { column: 'revision_id', op: 'eq', value: 'draft-rev' },
      ])
      assert.equal(state.selected, 'id')
      assert.equal(state.terminal, 'maybeSingle')
      return { data: { id: 'pcp-1' }, error: null }
    })
    await updatePcpRow(supabase, 'pcp-1', 'draft-rev', { control_method: 'Gauge' })
  }

  {
    const supabase = createSupabase(() => ({ data: null, error: null }))
    await assert.rejects(
      () => updatePcpRow(supabase, 'missing-row', 'draft-rev', { control_method: 'Gauge' }),
      /PCP row update did not persist/
    )
  }

  {
    const supabase = createSupabase((state) => {
      if (state.table === 'projects_with_revision') {
        return {
          data: {
            id: 'project-1',
            name: 'Process',
            status: 'OPEN',
            current_open_revision_id: 'open-rev',
            current_draft_revision_id: 'draft-rev',
            open_revision_label: '1.2.3',
            draft_revision_label: '1.2.3',
          },
          error: null,
        }
      }
      if (state.table === 'pfmea_edit_sessions') {
        return {
          data: {
            project_id: 'project-1',
            locked_by: 'user-1',
            last_activity_at: '2026-05-20T10:00:00.000Z',
          },
          error: null,
        }
      }
      if (state.table === 'pfmea_rows') return { data: [{ id: 'pfmea-draft-row' }], error: null }
      return { data: null, error: null }
    })
    const context = await resolvePcpRevisionContext(supabase, {
      editLockMs: 48 * 60 * 60 * 1000,
      nowMs: new Date('2026-05-20T10:05:00.000Z').getTime(),
      pcpDraftRevisionIdOverride: null,
      pcpIsEditOwner: true,
      projectId: 'project-1',
    })
    assert.equal(context.pcpTargetRevisionId, 'draft-rev')
    assert.equal(context.pcpHydrateSourceRevisionId, 'open-rev')
    assert.equal(context.pfmeaSourceRevisionId, 'draft-rev')
    assert.equal(context.pfmeaDraftIsActive, true)
  }

  {
    const supabase = createSupabase((state) => {
      if (state.table === 'projects_with_revision') {
        return {
          data: {
            id: 'project-1',
            name: 'Process',
            status: 'OPEN',
            current_open_revision_id: 'open-rev',
            current_draft_revision_id: 'draft-rev',
            open_revision_label: '1.2.3',
            draft_revision_label: '1.2.3',
          },
          error: null,
        }
      }
      if (state.table === 'pfmea_edit_sessions') {
        return {
          data: {
            project_id: 'project-1',
            locked_by: 'user-1',
            last_activity_at: '2026-05-20T10:00:00.000Z',
          },
          error: null,
        }
      }
      if (state.table === 'pfmea_rows') return { data: [{ id: 'pfmea-draft-row' }], error: null }
      return { data: null, error: null }
    })
    await assert.rejects(
      () => preparePcpDraftForPublish(supabase, {
        editLockMs: 48 * 60 * 60 * 1000,
        nowMs: new Date('2026-05-20T10:05:00.000Z').getTime(),
        projectId: 'project-1',
        userId: 'user-1',
      }),
      /PFMEA draft is active/
    )
  }

  {
    const deletedControlRows = []
    let insertedPfmeaRows = null
    const supabase = createSupabase((state) => {
      if (state.table === 'projects_with_revision') {
        return {
          data: {
            id: 'project-1',
            name: 'Process',
            status: 'OPEN',
            current_open_revision_id: 'open-rev',
            current_draft_revision_id: 'draft-rev',
            open_revision_label: '1.2.3',
            draft_revision_label: '1.2.3',
          },
          error: null,
        }
      }
      if (state.table === 'pfmea_edit_sessions') return { data: null, error: null }
      if (state.table === 'pfmea_rows' && state.deleteRequested) return { data: null, error: null }
      if (state.table === 'pfmea_rows' && state.insertPayload) {
        insertedPfmeaRows = state.insertPayload
        return { data: null, error: null }
      }
      if (state.table === 'pfmea_rows' && state.selected === 'risk_uid') {
        return { data: [{ risk_uid: 'risk-stable' }], error: null }
      }
      if (state.table === 'pfmea_rows') {
        return {
          data: [{
            risk_uid: 'risk-stable',
            operation_id: 'op-1',
            row_no: '10',
            failure_mode: 'Leak',
            pcp: true,
            created_at: '2026-05-18T10:00:00.000Z',
          }],
          error: null,
        }
      }
      if (state.table === 'control_plan_rows' && state.deleteRequested) {
        deletedControlRows.push(...state.filters.find((filter) => filter.op === 'in').value)
        return { data: null, error: null }
      }
      if (state.table === 'control_plan_rows') {
        return {
          data: [
            { id: 'pcp-keep', risk_uid: 'risk-stable' },
            { id: 'pcp-delete', risk_uid: 'risk-draft-only' },
          ],
          error: null,
        }
      }
      return { data: null, error: null }
    })
    await preparePcpDraftForPublish(supabase, {
      editLockMs: 48 * 60 * 60 * 1000,
      nowMs: new Date('2026-05-20T10:05:00.000Z').getTime(),
      projectId: 'project-1',
      userId: 'user-1',
    })
    assert.equal(insertedPfmeaRows[0].revision_id, 'draft-rev')
    assert.deepEqual(deletedControlRows, ['pcp-delete'])
  }

  {
    const migrationSource = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260520120000_pfmea_pcp_risk_uid.sql'), 'utf8')
    assert.match(migrationSource, /drop constraint if exists ux_pcp_auto_per_op_characteristic/i)
    assert.match(migrationSource, /drop index if exists public\.ux_pcp_auto_per_op_characteristic/i)
    assert.doesNotMatch(migrationSource, /on conflict \(operation_id, characteristic\)/i)
    assert.match(migrationSource, /where revision_id = new\.revision_id\s+and risk_uid = new\.risk_uid\s+and source = 'AUTO'/i)
  }

  {
    const migrationSource = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260520133000_pcp_revision_risk_uid_dedupe.sql'), 'utf8')
    assert.match(migrationSource, /partition by revision_id, risk_uid/i)
    assert.match(migrationSource, /delete from public\.control_plan_rows/i)
    assert.match(migrationSource, /create unique index if not exists ux_control_plan_rows_revision_risk_uid/i)
    assert.match(migrationSource, /where risk_uid is not null/i)
  }

  {
    const migrationSource = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260520143000_pcp_auto_generate_upsert.sql'), 'utf8')
    assert.match(migrationSource, /on conflict \(revision_id, risk_uid\) where risk_uid is not null/i)
    assert.match(migrationSource, /when public\.control_plan_rows\.source = 'AUTO' then excluded\.status/i)
    assert.doesNotMatch(migrationSource, /and source = 'AUTO'/i)
  }

  {
    const migrationSource = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260520153000_pcp_auto_generate_rpn_current.sql'), 'utf8')
    assert.match(migrationSource, /coalesce\(new\.rpn_current, new\.rpn\).*>= 200/is)
    assert.match(migrationSource, /on conflict \(revision_id, risk_uid\) where risk_uid is not null/i)
  }

  console.log('pcp service smoke passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
