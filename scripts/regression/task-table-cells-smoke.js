const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'task-management', 'page.tsx'), 'utf8')
const cellsSource = fs.readFileSync(path.join(root, 'src', 'features', 'tasks', 'task-table-cells.tsx'), 'utf8')

assert.match(cellsSource, /export function TaskResponsibleCell/, 'Task table cells must export responsible cell.')
assert.match(cellsSource, /export function TaskTargetDateCell/, 'Task table cells must export target date cell.')
assert.match(cellsSource, /export function TaskStatusCell/, 'Task table cells must export status cell.')
assert.match(cellsSource, /onBlur=\{commit\}/, 'Responsible cell must still commit on blur.')
assert.match(cellsSource, /onKeyDown=\{\(event\) =>/, 'Responsible cell must still handle keyboard commit/cancel.')

assert.match(pageSource, /from '@\/features\/tasks\/task-table-cells'/, 'Task page must import shared task table cells.')
assert.match(pageSource, /TaskResponsibleCell/, 'Task page must use responsible cell from shared cells.')
assert.match(pageSource, /TaskTargetDateCell/, 'Task page must use target date cell from shared cells.')
assert.match(pageSource, /TaskStatusCell/, 'Task page must use status cell from shared cells.')
assert.doesNotMatch(pageSource, /function TaskResponsibleCell/, 'Task page should not define responsible cell inline.')
assert.doesNotMatch(pageSource, /function TaskTargetDateCell/, 'Task page should not define target date cell inline.')
assert.doesNotMatch(pageSource, /function TaskStatusCell/, 'Task page should not define status cell inline.')

console.log('task table cells smoke passed')
