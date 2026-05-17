const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pcp', 'page.tsx'), 'utf8')
const dialogsSource = fs.readFileSync(path.join(root, 'src', 'features', 'pcp', 'pcp-dialogs.tsx'), 'utf8')

assert.match(dialogsSource, /export function PcpSaveDialog/, 'PCP dialogs must export save dialog.')
assert.match(dialogsSource, /export function PcpHistoryDialog/, 'PCP dialogs must export history dialog.')
assert.match(dialogsSource, /nextPcpRevisionLabel/, 'PCP save dialog must preserve next revision preview.')
assert.match(dialogsSource, /formatDateTimePL/, 'PCP history dialog must preserve date formatting.')
assert.match(dialogsSource, /Describe what you changed\./, 'PCP save dialog must preserve description prompt.')
assert.match(dialogsSource, /No saved history yet\./, 'PCP history dialog must preserve empty state.')
assert.match(dialogsSource, /Loading history\.\.\./, 'PCP history dialog must preserve loading state.')
assert.match(dialogsSource, /onClick=\{onSaveClick\}/, 'PCP save dialog must delegate save click to page callback.')

assert.match(pageSource, /from '@\/features\/pcp\/pcp-dialogs'/, 'PCP page must import extracted dialogs.')
assert.match(pageSource, /<PcpSaveDialog[\s\S]*handleSaveRevision\(saveDescription\)/, 'PCP page must wire save dialog to save revision handler.')
assert.match(pageSource, /<PcpHistoryDialog[\s\S]*entries=\{historyEntries\}/, 'PCP page must wire history dialog entries.')
assert.doesNotMatch(pageSource, /PCP revision history<\/span>/, 'PCP page should not render history dialog inline.')
assert.doesNotMatch(pageSource, /Describe what you changed\./, 'PCP page should not render save dialog inline.')

console.log('pcp dialogs smoke passed')
