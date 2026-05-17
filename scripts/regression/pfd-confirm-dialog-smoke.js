const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const dialogSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-confirm-dialog.tsx'), 'utf8')

assert.match(dialogSource, /export type PfdConfirmDialogConfig/, 'PFD confirm dialog config type must be exported.')
assert.match(dialogSource, /export function PfdConfirmDialog/, 'PFD confirm dialog component must be exported.')
assert.match(dialogSource, /props\.dialog\.dangerNote/, 'PFD confirm dialog must preserve danger note rendering.')
assert.match(dialogSource, /Cancel/, 'PFD confirm dialog must preserve cancel action label.')
assert.match(dialogSource, /Yes/, 'PFD confirm dialog must preserve confirm action label.')

assert.match(pageSource, /import \{ PfdConfirmDialog, type PfdConfirmDialogConfig \}/, 'PFD page must import confirm dialog component and type.')
assert.match(pageSource, /<PfdConfirmDialog[\s\S]*dialog=\{confirmDialog\}[\s\S]*onConfirm=\{async \(\) =>/, 'PFD page must delegate confirm modal rendering.')
assert.doesNotMatch(pageSource, /confirmDialog && \(/, 'PFD page should not own confirm dialog JSX after extraction.')

console.log('pfd confirm dialog smoke passed')
