const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'settings', 'invitations', 'page.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'settings', 'invitations-page-model.ts'), 'utf8')

assert.match(modelSource, /export const DEFAULT_INVITATION_HIDDEN_COLUMNS/, 'Invitation page model must export hidden-column defaults.')
assert.match(modelSource, /export const BASE_INVITATION_COLUMN_WIDTHS/, 'Invitation page model must export table column widths.')
assert.match(modelSource, /export function getInvitationSummary/, 'Invitation page model must export summary calculator.')
assert.match(modelSource, /export function getInvitationFilterOptions/, 'Invitation page model must export filter option builder.')
assert.match(modelSource, /export function getDisplayedInvites/, 'Invitation page model must export displayed-row calculator.')
assert.match(modelSource, /export function mapInviteError/, 'Invitation page model must export invite error mapper.')

assert.match(pageSource, /from '@\/features\/settings\/invitations-page-model'/, 'Invitations page must import the extracted page model.')
assert.doesNotMatch(pageSource, /function uniqueSorted/, 'Invitations page should not keep filter helper inline.')
assert.doesNotMatch(pageSource, /function invitationSortValue/, 'Invitations page should not keep sort helper inline.')
assert.doesNotMatch(pageSource, /function mapInviteError/, 'Invitations page should not keep error mapper inline.')
assert.doesNotMatch(pageSource, /type InvitationLayoutColumnKey =/, 'Invitations page should not keep table model types inline.')

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

const model = loadTypeScriptModule(['src', 'features', 'settings', 'invitations-page-model.ts'], {
  './invitations-service': {
    displayInviteStatus: (row) => row.status,
    formatInviteRole: (role) =>
      ({
        admin: 'Admin',
        champion: 'Champion',
        customer: 'Customer',
        engineer: 'Engineer',
        viewer: 'Viewer',
      })[String(role).toLowerCase()] ?? String(role),
  },
})

function assertJsonEqual(actual, expected, message) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message)
}

assert.equal(model.DEFAULT_INVITATION_HIDDEN_COLUMNS.email, false)
assert.equal(model.BASE_INVITATION_COLUMN_WIDTHS.actions, 330)
assert.equal(model.normalizeBasePath('/riskflow/'), '/riskflow')
assert.equal(model.normalizeBasePath('/'), '')
assert.equal(model.formatDateTime(null), '-')
assert.equal(model.formatDateTime('not-a-date'), '-')
assertJsonEqual(model.getAllowedInvitationRoles('viewer', null), ['engineer', 'viewer', 'customer'])
assertJsonEqual(model.getAllowedInvitationRoles('champion', null), ['engineer', 'viewer', 'customer', 'champion'])
assertJsonEqual(model.getAllowedInvitationRoles(null, 'admin'), ['engineer', 'viewer', 'customer', 'champion'])

const invites = [
  {
    accepted_at: null,
    created_at: '2026-05-03T12:00:00.000Z',
    email: 'zoe@example.com',
    first_name: 'Zoe',
    id: '3',
    invitation_id: '3',
    last_name: 'Beta',
    role: 'viewer',
    source: 'invitation',
    status: 'PENDING',
    token: 'token-3',
    user_id: null,
  },
  {
    accepted_at: '2026-05-02T12:00:00.000Z',
    created_at: '2026-05-01T12:00:00.000Z',
    email: 'adam@example.com',
    first_name: 'Adam',
    id: '1',
    invitation_id: null,
    last_name: 'Alpha',
    role: 'champion',
    source: 'member',
    status: 'ACTIVE',
    token: null,
    user_id: 'user-1',
  },
  {
    accepted_at: null,
    created_at: '2026-05-02T12:00:00.000Z',
    email: 'barbara@example.com',
    first_name: 'Barbara',
    id: '2',
    invitation_id: '2',
    last_name: 'Gamma',
    role: 'engineer',
    source: 'invitation',
    status: 'NOACTIVE',
    token: null,
    user_id: null,
  },
]

const summary = model.getInvitationSummary(invites, { invites_allowed_total: 5, valid_to: null })
assert.equal(summary.usedSeats, 2)
assert.equal(summary.freeSeats, 3)
assert.equal(summary.pendingCount, 1)
assert.equal(summary.activeCount, 1)
assert.equal(summary.activeChampionCount, 1)

const options = model.getInvitationFilterOptions(invites)
assertJsonEqual(options.nameOptions, ['Adam Alpha', 'Barbara Gamma', 'Zoe Beta'])
assertJsonEqual(options.roleOptions, ['Champion', 'Engineer', 'Viewer'])
assertJsonEqual(options.statusOptions, ['ACTIVE', 'NOACTIVE', 'PENDING'])

const filtered = model.getDisplayedInvites(
  invites,
  {
    selectedEmails: null,
    selectedNames: null,
    selectedRoles: ['Engineer', 'Viewer'],
    selectedStatuses: null,
  },
  { column: 'email', direction: 'asc' }
)
assertJsonEqual(
  filtered.map((row) => row.email),
  ['barbara@example.com', 'zoe@example.com']
)

const createdDesc = model.getDisplayedInvites(
  invites,
  {
    selectedEmails: null,
    selectedNames: null,
    selectedRoles: null,
    selectedStatuses: null,
  },
  { column: 'created', direction: 'desc' }
)
assertJsonEqual(
  createdDesc.map((row) => row.id),
  ['3', '2', '1']
)

assert.equal(model.mapInviteError('License seats limit exceeded'), 'License limit reached for your organization.')
assert.equal(model.mapInviteError('duplicate organization invitation'), 'An invitation for this email already exists in your organization.')

console.log('settings invitations page model smoke passed')
