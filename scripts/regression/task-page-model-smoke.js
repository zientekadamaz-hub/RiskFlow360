const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'task-management', 'page.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'tasks', 'task-page-model.ts'), 'utf8')

assert.match(modelSource, /export type TaskSummary/, 'Task page model must export summary type.')
assert.match(modelSource, /export const TASK_COLUMN_BASE_WIDTHS/, 'Task page model must export table widths.')
assert.match(modelSource, /export const TASK_STATUS_OPTIONS/, 'Task page model must export status options.')
assert.match(modelSource, /export function calculateTaskSummary/, 'Task page model must export summary calculator.')
assert.match(modelSource, /export function normalizeStatus/, 'Task page model must export status normalizer.')
assert.match(modelSource, /export function anchoredPopupStyle/, 'Task page model must export popup positioning helper.')

assert.match(pageSource, /from '@\/features\/tasks\/task-page-model'/, 'Task page must import shared page model.')
assert.doesNotMatch(pageSource, /type TaskSummary =/, 'Task page should not define summary type inline.')
assert.doesNotMatch(pageSource, /const TASK_COLUMN_BASE_WIDTHS: Record/, 'Task page should not define widths inline.')
assert.doesNotMatch(pageSource, /function calculateTaskSummary/, 'Task page should not define summary calculator inline.')
assert.doesNotMatch(pageSource, /function normalizeStatus/, 'Task page should not define status normalizer inline.')

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

const model = loadTypeScriptModule(['src', 'features', 'tasks', 'task-page-model.ts'], {
  '@/features/projects/view-styles': {
    projectsAvgRpnStyle: (value) => ({ value }),
    projectsTableCellStyle: { color: '#f8fafc' },
    projectsTableHeaderStyle: { color: '#f8fafc' },
  },
  '@/lib/error-utils': {
    errorText: (error, fallback) => (error instanceof Error ? error.message : fallback),
  },
})

assert.equal(model.DEFAULT_HIDDEN_COLUMNS.process, false)
assert.equal(model.TASK_COLUMN_BASE_WIDTHS.process, 180)
assert.equal(model.normalizeStatus('done'), 'CLOSED')
assert.equal(model.normalizeStatus('in_progress'), 'IN PROGRESS')
assert.equal(model.formatNumber(144.4), '144')
assert.equal(model.formatDate(null), '-')

const rows = [
  { status: 'OPEN', targetDate: null, responsible: '-', process: 'A', site: 'Poznan', failureMode: 'Leak', rpn: 100, rpnAfter: 80, recommendedAction: 'Check' },
  { status: 'IN_PROGRESS', targetDate: null, responsible: 'Adam', process: 'B', site: 'Poznan', failureMode: 'Noise', rpn: 200, rpnAfter: 120, recommendedAction: 'Fix' },
  { status: 'CLOSED', targetDate: null, responsible: 'Oliwia', process: 'C', site: 'Poznan', failureMode: 'Scratch', rpn: 300, rpnAfter: 90, recommendedAction: 'Verify' },
]
const summary = model.calculateTaskSummary(rows, 2)
assert.equal(summary.total, 3)
assert.equal(summary.openProjects, 2)
assert.equal(summary.openActions, 1)
assert.equal(summary.inProgress, 1)
assert.equal(summary.closed, 1)
assert.equal(summary.withoutOwner, 1)

console.log('task page model smoke passed')
