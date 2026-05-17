const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'task-management', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'tasks', 'use-task-actions-controller.ts'), 'utf8')

assert.match(hookSource, /export function useTaskActionsController/, 'Task actions controller hook must be exported.')
assert.match(hookSource, /getSessionUserWithRetries\(\)/, 'Task actions controller must keep authenticated user loading.')
assert.match(hookSource, /fetchTaskActions\(supabase, user\.id\)/, 'Task actions controller must keep task fetch service wiring.')
assert.match(hookSource, /updateTaskActionStatus\(supabase/, 'Task actions controller must keep status update service wiring.')
assert.match(hookSource, /updateTaskActionDetails\(supabase/, 'Task actions controller must keep details update service wiring.')
assert.match(hookSource, /setRows\(\(current\) => current\.map/, 'Task actions controller must keep optimistic row updates.')
assert.match(hookSource, /visibilitychange/, 'Task actions controller must keep refresh-on-visible behavior.')

assert.match(pageSource, /useTaskActionsController\(\)/, 'Task page must use task actions controller.')
assert.doesNotMatch(pageSource, /fetchTaskActions/, 'Task page should not fetch task actions inline.')
assert.doesNotMatch(pageSource, /updateTaskActionStatus/, 'Task page should not update status inline.')
assert.doesNotMatch(pageSource, /updateTaskActionDetails/, 'Task page should not update details inline.')
assert.doesNotMatch(pageSource, /getSessionUserWithRetries/, 'Task page should not read auth session inline.')

console.log('task actions controller smoke passed')
