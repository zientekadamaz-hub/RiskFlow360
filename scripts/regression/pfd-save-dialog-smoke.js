const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const dialogSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-save-dialog.tsx'), 'utf8')

assert.match(dialogSource, /export function PfdSaveDialog/, 'PFD save dialog component must be exported.')
assert.match(dialogSource, /function nextRevisionLabel/, 'PFD save dialog must preserve next revision display calculation.')
assert.match(dialogSource, /Describe changes \(required\)/, 'PFD save dialog must preserve required description placeholder.')
assert.match(dialogSource, /disabled=\{props\.busy \|\| !props\.description\.trim\(\)\}/, 'PFD save dialog must disable save without a description.')
assert.match(dialogSource, /props\.onSave/, 'PFD save dialog must call the save callback.')

assert.match(pageSource, /import \{ PfdSaveDialog \}/, 'PFD page must import the save dialog component.')
assert.match(pageSource, /<PfdSaveDialog[\s\S]*open=\{saveDialogOpen\}[\s\S]*onSave=\{savePfdWithDescription\}/, 'PFD page must delegate save dialog rendering.')
assert.doesNotMatch(pageSource, /saveDialogOpen && \(/, 'PFD page should not own save dialog JSX after extraction.')

console.log('pfd save dialog smoke passed')
