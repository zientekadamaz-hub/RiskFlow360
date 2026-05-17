const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'use-pfd-session-controller.ts'), 'utf8')

assert.match(hookSource, /export function usePfdSessionController/, 'PFD session controller hook must be exported.')
assert.match(hookSource, /fetchPfdModuleAccess/, 'PFD session controller must own module access checks.')
assert.match(hookSource, /fetchPfdUserContext/, 'PFD session controller must own user context loading.')
assert.match(hookSource, /fetchPfdEditSession/, 'PFD session controller must own edit session loading.')
assert.match(hookSource, /fetchUnreadPfdSessionNotice/, 'PFD session controller must own session notice loading.')
assert.match(hookSource, /heartbeatPfdEditSession/, 'PFD session controller must own heartbeat.')
assert.match(hookSource, /const EDIT_LOCK_MS/, 'PFD session controller must preserve edit lock timeout.')

assert.match(pageSource, /usePfdSessionController\(\{ projectId, supabase \}\)/, 'PFD page must use the session controller hook.')
assert.doesNotMatch(pageSource, /fetchPfdModuleAccess/, 'PFD page should not check module access directly after session extraction.')
assert.doesNotMatch(pageSource, /fetchPfdUserContext/, 'PFD page should not load user context directly after session extraction.')
assert.doesNotMatch(pageSource, /heartbeatPfdEditSession/, 'PFD page should not heartbeat directly after session extraction.')

console.log('pfd session controller smoke passed')
