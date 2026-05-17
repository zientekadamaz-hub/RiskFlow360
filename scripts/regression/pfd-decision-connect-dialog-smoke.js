const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const dialogSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-decision-connect-dialog.tsx'), 'utf8')

assert.match(dialogSource, /export type PfdDecisionConnectDialogConfig/, 'PFD decision connect dialog config type must be exported.')
assert.match(dialogSource, /export function PfdDecisionConnectDialog/, 'PFD decision connect dialog component must be exported.')
assert.match(dialogSource, /Decision output label/, 'PFD decision connect dialog must preserve title.')
assert.match(dialogSource, /Enter a label for this decision path\./, 'PFD decision connect dialog must preserve helper text.')
assert.match(dialogSource, /props\.onAdd\(\)/, 'PFD decision connect dialog must call the add callback.')
assert.match(dialogSource, /event\.key !== 'Enter'/, 'PFD decision connect dialog must preserve Enter key submission.')

assert.match(pageSource, /import \{[\s\S]*PfdDecisionConnectDialog,[\s\S]*type PfdDecisionConnectDialogConfig,[\s\S]*\}/, 'PFD page must import decision connect dialog component and type.')
assert.match(pageSource, /<PfdDecisionConnectDialog[\s\S]*dialog=\{decisionConnectDialog\}[\s\S]*commitConnection\(/, 'PFD page must keep connection commit logic outside the extracted dialog.')
assert.doesNotMatch(pageSource, /decisionConnectDialog && \(/, 'PFD page should not own decision connect dialog JSX after extraction.')

console.log('pfd decision connect dialog smoke passed')
