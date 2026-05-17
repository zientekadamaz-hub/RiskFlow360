const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'use-pfd-edit-session-actions.ts'), 'utf8')

assert.match(hookSource, /export function usePfdEditSessionActions/, 'PFD edit session actions hook must be exported.')
assert.match(hookSource, /startPfdEditSession/, 'PFD edit session actions must own edit session starts.')
assert.match(hookSource, /discardPfdDraftAndCloseSession/, 'PFD edit session actions must own draft discard.')
assert.match(hookSource, /resetDraftLoad/, 'PFD edit session actions must reset draft loading.')
assert.match(hookSource, /loadEditSession/, 'PFD edit session actions must refresh edit session state.')
assert.match(hookSource, /loadAll/, 'PFD edit session actions must reload canvas after discard.')

assert.match(pageSource, /usePfdEditSessionActions\(\{/, 'PFD page must use edit session actions hook.')
assert.doesNotMatch(pageSource, /startPfdEditSession/, 'PFD page should not start edit sessions directly after action extraction.')
assert.doesNotMatch(pageSource, /discardPfdDraftAndCloseSession/, 'PFD page should not discard drafts directly after action extraction.')
assert.match(pageSource, /startEditSession/, 'PFD page must still pass start edit action to UI.')
assert.match(pageSource, /discardDraftAndCloseSession/, 'PFD page must still pass discard action to UI.')

console.log('pfd edit session actions smoke passed')
