const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'task-management', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'tasks', 'use-task-table-controller.ts'), 'utf8')

assert.match(hookSource, /export function useTaskTableController/, 'Task table controller hook must be exported.')
assert.match(hookSource, /useState<TaskFilterState>\(DEFAULT_FILTERS\)/, 'Task filters state must live in the controller.')
assert.match(hookSource, /useState<TaskHiddenColumns>\(DEFAULT_HIDDEN_COLUMNS\)/, 'Task hidden columns state must live in the controller.')
assert.match(hookSource, /calculateTaskSummary\(rows, openProjects\)/, 'Task header summary must be derived in the controller.')
assert.match(hookSource, /getSettingsTableColumnWidths<TaskColumnKey>/, 'Task column widths must use the standard table width helper.')
assert.match(hookSource, /columnSortValue\(left, sortState\.column\)/, 'Task sorting must remain based on shared column sort values.')

assert.match(pageSource, /useTaskTableController\(\{ openProjects: summary\.openProjects, rows \}\)/, 'Task page must use the table controller.')
assert.match(pageSource, /settingsTableScrollerStyle/, 'Task page table viewport must use the shared table scroller style.')
assert.match(pageSource, /minWidth: TASK_TABLE_MIN_WIDTH/, 'Task page table must keep a stable minimum width for horizontal scrolling.')
assert.doesNotMatch(pageSource, /const filterOptions = useMemo/, 'Task page should not build filter options inline.')
assert.doesNotMatch(pageSource, /const displayedRows = useMemo/, 'Task page should not filter and sort rows inline.')
assert.doesNotMatch(pageSource, /const columnWidths = useMemo/, 'Task page should not calculate column widths inline.')
assert.doesNotMatch(pageSource, /const hiddenCellStyle: CSSProperties/, 'Task page should not build hidden cell styles inline.')

console.log('task table controller smoke passed')
