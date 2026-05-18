const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const serviceSource = fs.readFileSync(path.join(root, 'src', 'features', 'tasks', 'task-service.ts'), 'utf8')
const statusSource = fs.readFileSync(path.join(root, 'src', 'features', 'tasks', 'task-status-utils.ts'), 'utf8')

assert.match(
  statusSource,
  /export function normalizeTaskStatus/,
  'Task status normalization must live in a shared utility.'
)

assert.match(
  serviceSource,
  /import \{ isTerminalTaskStatus, normalizeTaskStatus \} from '\.\/task-status-utils'/,
  'Task service must use shared task status normalization.'
)

assert.match(
  serviceSource,
  /function getTaskProjectRevisionId/,
  'Task service must centralize project revision selection.'
)

assert.match(
  serviceSource,
  /return normalizeProjectText\(project\.current_open_revision_id\) \|\| normalizeProjectText\(project\.current_draft_revision_id\)/,
  'Task service must prefer the current open revision so empty drafts do not hide linked PFMEA actions.'
)

assert.match(
  serviceSource,
  /status: normalizeTaskStatus\(row\.action_status\)/,
  'Task rows must expose normalized action statuses.'
)

assert.match(
  serviceSource,
  /parsed < today && !isTerminalTaskStatus\(row\.status\)/,
  'Task overdue counts must exclude both closed and canceled actions.'
)

console.log('task service smoke passed')
