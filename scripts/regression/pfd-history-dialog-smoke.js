const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const dialogSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-history-dialog.tsx'), 'utf8')

assert.match(dialogSource, /export function PfdHistoryDialog/, 'PFD history dialog component must be exported.')
assert.match(dialogSource, /PFD change history/, 'PFD history dialog must preserve title.')
assert.match(dialogSource, /No saved history yet\./, 'PFD history dialog must preserve empty state.')
assert.match(dialogSource, /props\.entries\.map/, 'PFD history dialog must render history entries.')
assert.match(dialogSource, /new Date\(entry\.at\)\.toLocaleString\(\)/, 'PFD history dialog must preserve date formatting.')

assert.match(pageSource, /import \{ PfdHistoryDialog \}/, 'PFD page must import history dialog component.')
assert.match(pageSource, /<PfdHistoryDialog[\s\S]*entries=\{historyEntries\}[\s\S]*open=\{historyOpen\}/, 'PFD page must delegate history dialog rendering.')
assert.doesNotMatch(pageSource, /historyOpen && \(/, 'PFD page should not own history dialog JSX after extraction.')

console.log('pfd history dialog smoke passed')
