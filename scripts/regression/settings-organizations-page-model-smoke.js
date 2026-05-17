const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'settings', 'organizations', 'page.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'settings', 'organizations-page-model.ts'), 'utf8')

assert.match(modelSource, /export const DEFAULT_ORGANIZATION_HIDDEN_COLUMNS/, 'Organizations page model must export hidden-column defaults.')
assert.match(modelSource, /export const BASE_ORGANIZATION_COLUMN_WIDTHS/, 'Organizations page model must export table widths.')
assert.match(modelSource, /export function buildOrganizationTableRows/, 'Organizations page model must export table-row builder.')
assert.match(modelSource, /export function getOrganizationFilterOptions/, 'Organizations page model must export filter options.')
assert.match(modelSource, /export function getDisplayedOrganizations/, 'Organizations page model must export displayed organization calculator.')

assert.match(pageSource, /from '@\/features\/settings\/organizations-page-model'/, 'Organizations page must import extracted page model.')
assert.doesNotMatch(pageSource, /function uniqueSorted/, 'Organizations page should not keep filter helper inline.')
assert.doesNotMatch(pageSource, /function compareNullableDate/, 'Organizations page should not keep date comparator inline.')
assert.doesNotMatch(pageSource, /function isOpenAccessRequestStatus/, 'Organizations page should not keep open-request logic inline.')
assert.doesNotMatch(pageSource, /type OrganizationTableRow =/, 'Organizations page should not keep table-row union inline.')

function loadTypeScriptModule(relativePath) {
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
    require,
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

function assertJsonEqual(actual, expected, message) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message)
}

const model = loadTypeScriptModule(['src', 'features', 'settings', 'organizations-page-model.ts'])

assert.equal(model.DEFAULT_ORGANIZATION_HIDDEN_COLUMNS.organization, false)
assert.equal(model.BASE_ORGANIZATION_COLUMN_WIDTHS.champion, 300)
assert.equal(model.normalizeBasePath('/riskflow/'), '/riskflow')
assert.equal(model.formatDate(null), '-')
assert.equal(model.formatDate('not-a-date'), '-')
assert.equal(model.statusLabel(null), '-')
assert.equal(model.statusLabel('pending'), 'PENDING')
assert.equal(model.isOpenAccessRequestStatus(null), true)
assert.equal(model.isOpenAccessRequestStatus('APPROVED'), false)

const organizations = [
  {
    active: true,
    champion_email: 'adam@example.com',
    champion_first_name: 'Adam',
    champion_invitation_token: null,
    champion_last_name: 'Alpha',
    champion_source: 'member',
    champion_status: 'ASSIGNED',
    created_at: '2026-05-01T12:00:00.000Z',
    invites_allowed_total: 10,
    organization_id: 'org-1',
    organization_name: 'RiskFlow',
    seats_purchased: 10,
    valid_to: '2026-12-31',
  },
  {
    active: true,
    champion_email: 'zoe@example.com',
    champion_first_name: null,
    champion_invitation_token: 'token-2',
    champion_last_name: null,
    champion_source: 'invitation',
    champion_status: 'PENDING',
    created_at: '2026-05-03T12:00:00.000Z',
    invites_allowed_total: 5,
    organization_id: 'org-2',
    organization_name: 'Watlow',
    seats_purchased: 5,
    valid_to: null,
  },
]

const accessRequests = [
  {
    company_name: 'New Co',
    created_at: '2026-05-02T12:00:00.000Z',
    first_name: 'Barbara',
    handled_at: null,
    handled_by: null,
    handled_by_name: null,
    last_name: 'Beta',
    notes_admin: null,
    request_id: 'req-1',
    requested_invites: 20,
    requester_email: 'barbara@example.com',
    status: 'NEW',
  },
  {
    company_name: 'Closed Co',
    created_at: '2026-05-04T12:00:00.000Z',
    first_name: null,
    handled_at: null,
    handled_by: null,
    handled_by_name: null,
    last_name: null,
    notes_admin: null,
    request_id: 'req-2',
    requested_invites: 30,
    requester_email: 'closed@example.com',
    status: 'APPROVED',
  },
]

const summary = model.getOrganizationSummary(organizations, accessRequests)
assert.equal(summary.assignedChampionCount, 1)
assert.equal(summary.pendingChampionCount, 1)
assert.equal(summary.pendingAccessRequestCount, 1)

const tableRows = model.buildOrganizationTableRows(organizations, accessRequests)
assert.equal(tableRows.length, 3)
assertJsonEqual(
  tableRows.map((row) => row.key),
  ['organization-org-1', 'organization-org-2', 'request-req-1']
)
assert.equal(tableRows[2].status, 'NEW')
assert.equal(tableRows[2].championName, 'Barbara Beta')

const options = model.getOrganizationFilterOptions(tableRows)
assertJsonEqual(options.organizationOptions, ['New Co', 'RiskFlow', 'Watlow'])
assertJsonEqual(options.championStatusOptions, ['ASSIGNED', 'NEW', 'PENDING'])
assertJsonEqual(options.inviteOptions, ['10', '20', '5'])

const filtered = model.getDisplayedOrganizations(
  tableRows,
  {
    selectedChampionStatuses: ['NEW', 'PENDING'],
    selectedChampions: null,
    selectedCreatedDates: null,
    selectedInvites: null,
    selectedOrganizations: null,
    selectedSeats: null,
    selectedValidDates: null,
  },
  { column: 'organization', direction: 'asc' }
)
assertJsonEqual(
  filtered.map((row) => row.organizationName),
  ['New Co', 'Watlow']
)

const sortedBySeatsDesc = model.getDisplayedOrganizations(
  tableRows,
  {
    selectedChampionStatuses: null,
    selectedChampions: null,
    selectedCreatedDates: null,
    selectedInvites: null,
    selectedOrganizations: null,
    selectedSeats: null,
    selectedValidDates: null,
  },
  { column: 'seats', direction: 'desc' }
)
assertJsonEqual(
  sortedBySeatsDesc.map((row) => row.organizationName),
  ['New Co', 'RiskFlow', 'Watlow']
)

console.log('settings organizations page model smoke passed')
