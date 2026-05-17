const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'task-management', 'page.tsx'), 'utf8')
const headerSource = fs.readFileSync(path.join(root, 'src', 'features', 'tasks', 'task-table-header.tsx'), 'utf8')

assert.match(headerSource, /export function TasksTableHeader/, 'Task table header component must be exported.')
assert.match(headerSource, /SettingsFilterColumnHeader/, 'Task table header must keep filter menu wiring.')
assert.match(headerSource, /SettingsHiddenColumnHeader/, 'Task table header must keep hidden column restore wiring.')
assert.match(headerSource, /onSort=\{\(direction\) => setSortState\(\{ column: column\.key, direction \}\)\}/, 'Task table header must preserve sort callback.')
assert.match(headerSource, /onHideColumn=\{\(\) => setHiddenColumns/, 'Task table header must preserve hide column callback.')

assert.match(pageSource, /from '@\/features\/tasks\/task-table-header'/, 'Task page must import shared table header.')
assert.doesNotMatch(pageSource, /function TasksTableHeader/, 'Task page should not define table header inline.')
assert.doesNotMatch(pageSource, /SettingsFilterColumnHeader/, 'Task page should not import filter header directly.')
assert.doesNotMatch(pageSource, /SettingsHiddenColumnHeader/, 'Task page should not import hidden column header directly.')

console.log('task table header smoke passed')
