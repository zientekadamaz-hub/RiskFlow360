const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pcp', 'page.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'pcp', 'pcp-page-model.ts'), 'utf8')

assert.match(modelSource, /export type PcpColumnId/, 'PCP page model must export column ids.')
assert.match(modelSource, /export const PCP_COLUMNS/, 'PCP page model must export table columns.')
assert.match(modelSource, /export const DEFAULT_VISIBLE_COLUMNS/, 'PCP page model must export default visible columns.')
assert.match(modelSource, /export const EDIT_LOCK_MS/, 'PCP page model must export edit lock timeout.')
assert.match(modelSource, /export function makePcpPlaceholderRow/, 'PCP page model must export placeholder row factory.')
assert.match(modelSource, /export function anchoredPopupStyle/, 'PCP page model must export popup positioning helper.')
assert.match(modelSource, /export function formatDateTimePL/, 'PCP page model must export history date formatter.')
assert.match(modelSource, /export function getPcpEditState/, 'PCP page model must export edit state helper.')
assert.match(modelSource, /export function formatPcpLockRemainingText/, 'PCP page model must export lock remaining formatter.')
assert.match(modelSource, /export function getPcpWorkingRevision/, 'PCP page model must export working revision helper.')
assert.match(modelSource, /export function sortPcpRows/, 'PCP page model must export row sorting helper.')

assert.match(pageSource, /from '@\/features\/pcp\/pcp-page-model'/, 'PCP page must import shared page model.')
assert.doesNotMatch(pageSource, /type PcpColumnId =/, 'PCP page should not define column ids inline.')
assert.doesNotMatch(pageSource, /const PCP_COLUMNS: Array/, 'PCP page should not define table columns inline.')
assert.doesNotMatch(pageSource, /function makePcpPlaceholderRow/, 'PCP page should not define placeholder factory inline.')
assert.doesNotMatch(pageSource, /const indexed = rows\.map/, 'PCP page should not sort rows inline.')
assert.doesNotMatch(pageSource, /const left = Math\.max\(0, EDIT_LOCK_MS - \(sessionNow - last\)\)/, 'PCP page should not format lock timeout inline.')
assert.match(pageSource, /getPcpEditState/, 'PCP page must use shared edit state helper.')
assert.match(pageSource, /sortPcpRows\(rows\)/, 'PCP page must use shared row sorting helper.')

function loadTypeScriptModule(relativePath, moduleMap = {}) {
  const sourcePath = path.join(root, ...relativePath)
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
const model = loadTypeScriptModule(['src', 'features', 'pcp', 'pcp-page-model.ts'], {
  './pcp-utils': pcpUtils,
  './pcp-service': {},
})

assert.equal(model.PCP_COLUMNS.length, 15)
assert.equal(model.PCP_COLUMNS.reduce((sum, column) => sum + column.width, 0), 1236)
assert.equal(model.DEFAULT_VISIBLE_COLUMNS.reaction_plan, true)
assert.equal(model.formatDateTimePL(null), '-')
const placeholder = model.makePcpPlaceholderRow(
  { id: 'op-1', project_id: 'project-1', operation_number: 10, name: 'Assembly', machine: 'Line 1', operation: 'Fit' },
  'rev-1',
  'op-1:seed-1',
  { id: 'seed-1', failure_mode: 'Leak', characteristic: 'Torque', class: 'special characteristic', severity: '9', rpn: 300 }
)
assert.equal(placeholder.id, `${pcpUtils.PCP_PLACEHOLDER_PREFIX}op-1:seed-1`)
assert.equal(placeholder.revision_id, 'rev-1')
assert.equal(placeholder.class, 'SC')
assert.equal(placeholder.severity, 9)

const now = Date.parse('2026-05-17T12:00:00.000Z')
const activeSession = {
  projectId: 'project-1',
  lockedBy: 'user-1',
  startedAt: '2026-05-16T12:00:00.000Z',
  lastActivityAt: '2026-05-17T10:15:00.000Z',
}
const ownerState = model.getPcpEditState({ editSession: activeSession, now, projectStatus: 'OPEN', userId: 'user-1' })
assert.equal(ownerState.isObsolete, false)
assert.equal(ownerState.sessionExpired, false)
assert.equal(ownerState.isEditOwner, true)
assert.equal(ownerState.isLockedByOther, false)
assert.equal(ownerState.readOnly, false)
assert.equal(model.getPcpEditState({ editSession: activeSession, now, projectStatus: 'OPEN', userId: 'user-2' }).isLockedByOther, true)
assert.equal(model.getPcpEditState({ editSession: activeSession, now, projectStatus: 'OBSOLETE', userId: 'user-1' }).readOnly, true)
assert.equal(model.formatPcpLockRemainingText(activeSession, now), '46h 15m')
assert.equal(model.isPcpSessionExpired({ ...activeSession, lastActivityAt: '2026-05-15T11:59:59.000Z' }, now), true)

const projectView = {
  id: 'project-1',
  name: 'Project',
  status: 'OPEN',
  current_open_revision_id: 'open-1',
  current_draft_revision_id: 'draft-1',
  open_revision_label: '1.0',
  draft_revision_label: '1.1',
}
const revision = model.getPcpWorkingRevision(projectView, null)
assert.equal(revision.workingRevisionId, 'draft-1')
assert.equal(revision.workingRevisionLabel, '1.1')
assert.equal(model.getPcpWorkingRevision({ ...projectView, current_draft_revision_id: null, draft_revision_label: null }, 'override-1').workingRevisionId, 'override-1')

const sorted = model.sortPcpRows([
  { ...placeholder, id: 'row-b', operations: { ...placeholder.operations, operation_number: 20 }, __sortIndex: 0 },
  { ...placeholder, id: 'row-c', operations: { ...placeholder.operations, operation_number: 10 }, __sortIndex: 2 },
  { ...placeholder, id: 'row-a', operations: { ...placeholder.operations, operation_number: 10 }, __sortIndex: 1 },
]).map((row) => row.id)
assert.deepEqual(sorted, ['row-a', 'row-c', 'row-b'])

console.log('pcp page model smoke passed')
