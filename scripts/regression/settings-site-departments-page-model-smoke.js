const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'settings', 'sites-departments', 'page.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'settings', 'site-departments-page-model.ts'), 'utf8')

assert.match(modelSource, /export const DEFAULT_SITE_DEPARTMENT_HIDDEN_COLUMNS/, 'Site departments page model must export hidden-column defaults.')
assert.match(modelSource, /export const BASE_SITE_DEPARTMENT_COLUMN_WIDTHS/, 'Site departments page model must export table widths.')
assert.match(modelSource, /export function toUiRows/, 'Site departments page model must export UI row mapper.')
assert.match(modelSource, /export function normalizeDepartmentInputs/, 'Site departments page model must export department input normalizer.')
assert.match(modelSource, /export function getDisplayedSiteDepartmentRows/, 'Site departments page model must export displayed-row calculator.')

assert.match(pageSource, /from '@\/features\/settings\/site-departments-page-model'/, 'Sites departments page must import extracted page model.')
assert.doesNotMatch(pageSource, /function toUiRows/, 'Sites departments page should not keep UI row mapper inline.')
assert.doesNotMatch(pageSource, /function uniqueList/, 'Sites departments page should not keep unique-list helper inline.')
assert.doesNotMatch(pageSource, /type UiSiteRow =/, 'Sites departments page should not keep UI row type inline.')
assert.doesNotMatch(pageSource, /const BASE_COLUMN_WIDTHS/, 'Sites departments page should not keep table widths inline.')

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

const model = loadTypeScriptModule(['src', 'features', 'settings', 'site-departments-page-model.ts'])

assert.equal(model.DEFAULT_SITE_DEPARTMENT_HIDDEN_COLUMNS.site, false)
assert.equal(model.BASE_SITE_DEPARTMENT_COLUMN_WIDTHS.departments, 360)
assertJsonEqual(model.uniqueList([' Poznan ', 'poznan', '', ' Wroclaw ']), ['Poznan', 'Wroclaw'])

const sourceRows = [
  {
    active: true,
    created_at: '2026-05-01T12:00:00.000Z',
    department: 'Assembly',
    id: '1',
    organization_id: 'org-1',
    project_count: 2,
    site: 'Poznan',
  },
  {
    active: true,
    created_at: '2026-05-01T12:00:00.000Z',
    department: 'Quality',
    id: '2',
    organization_id: 'org-1',
    project_count: 0,
    site: 'Poznan',
  },
  {
    active: false,
    created_at: '2026-05-01T12:00:00.000Z',
    department: 'Lab',
    id: '3',
    organization_id: 'org-1',
    project_count: 1,
    site: 'Berlin',
  },
]

const uiRows = model.toUiRows(sourceRows)
assertJsonEqual(
  uiRows.map((row) => row.site),
  ['Berlin', 'Poznan']
)
assert.equal(uiRows[1].projectCount, 2)
assert.equal(uiRows[1].used, true)
assertJsonEqual(model.departmentNames(uiRows[1]), ['Assembly', 'Quality'])
assert.equal(model.statusLabel(uiRows[0]), 'INACTIVE')
assert.equal(model.usageLabel(uiRows[0]), 'USED')
assert.equal(model.getActiveSitesCount(uiRows), 1)

const normalizedInputs = model.normalizeDepartmentInputs([
  { originalName: null, projectCount: 0, used: false, value: ' Assembly' },
  { originalName: null, projectCount: 0, used: false, value: '' },
  { originalName: null, projectCount: 0, used: false, value: '' },
])
assertJsonEqual(
  normalizedInputs.map((row) => row.value),
  ['Assembly', '']
)

const options = model.getSiteDepartmentFilterOptions(uiRows)
assertJsonEqual(options.siteOptions, ['Berlin', 'Poznan'])
assertJsonEqual(options.departmentOptions, ['Assembly', 'Lab', 'Quality'])
assertJsonEqual(options.statusOptions, ['ACTIVE', 'INACTIVE'])
assertJsonEqual(options.usageOptions, ['USED', 'UNUSED'])

const filtered = model.getDisplayedSiteDepartmentRows(
  uiRows,
  {
    selectedDepartments: ['Assembly'],
    selectedSites: null,
    selectedStatuses: null,
    selectedUsage: null,
  },
  { column: 'site', direction: 'asc' }
)
assertJsonEqual(
  filtered.map((row) => row.site),
  ['Poznan']
)

const sortedByUsage = model.getDisplayedSiteDepartmentRows(
  uiRows,
  {
    selectedDepartments: null,
    selectedSites: null,
    selectedStatuses: null,
    selectedUsage: null,
  },
  { column: 'usage', direction: 'desc' }
)
assertJsonEqual(
  sortedByUsage.map((row) => row.site),
  ['Poznan', 'Berlin']
)

console.log('settings site departments page model smoke passed')
