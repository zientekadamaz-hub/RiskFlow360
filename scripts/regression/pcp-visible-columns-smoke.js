const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pcp', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'pcp', 'use-pcp-visible-columns.ts'), 'utf8')

assert.match(hookSource, /export function usePcpVisibleColumns/, 'PCP visible columns hook must be exported.')
assert.match(hookSource, /DEFAULT_VISIBLE_COLUMNS/, 'PCP visible columns hook must use shared default visibility.')
assert.match(hookSource, /PCP_VISIBLE_COLUMNS_KEY_PREFIX/, 'PCP visible columns hook must own localStorage key prefix.')
assert.match(hookSource, /window\.localStorage\.getItem/, 'PCP visible columns hook must load localStorage state.')
assert.match(hookSource, /window\.localStorage\.setItem/, 'PCP visible columns hook must persist localStorage state.')
assert.match(hookSource, /visibleColumnDefs/, 'PCP visible columns hook must expose visible column definitions.')
assert.match(hookSource, /settingsHiddenTableColumnWidthPx/, 'PCP hidden columns must retain a narrow restore column width.')
assert.match(hookSource, /widthOf/, 'PCP visible columns hook must expose width helper.')

assert.match(pageSource, /usePcpVisibleColumns\(userId\)/, 'PCP page must use visible columns hook.')
assert.doesNotMatch(pageSource, /useState<Record<PcpColumnId, boolean>>/, 'PCP page should not own visible column state.')
assert.doesNotMatch(pageSource, /localStorage\.getItem\(`\$\{PCP_VISIBLE_COLUMNS_KEY_PREFIX\}/, 'PCP page should not load visible columns from localStorage inline.')
assert.doesNotMatch(pageSource, /localStorage\.setItem\(`\$\{PCP_VISIBLE_COLUMNS_KEY_PREFIX\}/, 'PCP page should not persist visible columns to localStorage inline.')

console.log('pcp visible columns smoke passed')
