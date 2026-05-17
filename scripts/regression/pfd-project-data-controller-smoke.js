const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'use-pfd-project-data-controller.ts'), 'utf8')

assert.match(hookSource, /export function usePfdProjectDataController/, 'PFD project data controller hook must be exported.')
assert.match(hookSource, /fetchPfdHistory/, 'PFD project data controller must own history loading.')
assert.match(hookSource, /fetchPfdRevisionLabel/, 'PFD project data controller must own revision label loading.')
assert.match(hookSource, /fetchPfdProcessOptions/, 'PFD project data controller must own process option loading.')
assert.match(hookSource, /currentRevisionLabel/, 'PFD project data controller must expose current revision label.')
assert.match(hookSource, /historyEntries/, 'PFD project data controller must expose history entries.')
assert.match(hookSource, /processOptions/, 'PFD project data controller must expose process options.')

assert.match(pageSource, /usePfdProjectDataController\(\{ projectId, supabase \}\)/, 'PFD page must use the project data controller hook.')
assert.doesNotMatch(pageSource, /fetchPfdHistory/, 'PFD page should not fetch history directly after project data extraction.')
assert.doesNotMatch(pageSource, /fetchPfdRevisionLabel/, 'PFD page should not fetch revision labels directly after project data extraction.')
assert.doesNotMatch(pageSource, /fetchPfdProcessOptions/, 'PFD page should not fetch process options directly after project data extraction.')

console.log('pfd project data controller smoke passed')
