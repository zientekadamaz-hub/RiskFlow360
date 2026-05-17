const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const helperSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-flow-view-model.ts'), 'utf8')

assert.match(helperSource, /export function isPfdOperationSelected/, 'PFD flow view model must expose selected operation helper.')
assert.match(helperSource, /export function buildPfdNodesWithHandlers/, 'PFD flow view model must expose node handler builder.')
assert.match(helperSource, /export function buildPfdDefaultEdgeOptions/, 'PFD flow view model must expose default edge options builder.')
assert.match(helperSource, /export function buildPfdStyledEdges/, 'PFD flow view model must expose styled edge builder.')
assert.match(helperSource, /onOpenPfmea/, 'PFD flow view model must preserve PFMEA opening callback wiring.')
assert.match(helperSource, /processOptions/, 'PFD flow view model must preserve process options wiring.')
assert.match(helperSource, /editable: isEditOwner/, 'PFD flow view model must preserve editability wiring.')

assert.match(pageSource, /isPfdOperationSelected\(nodes, selectedNodeId\)/, 'PFD page must use selected operation helper.')
assert.match(pageSource, /buildPfdNodesWithHandlers\(\{/, 'PFD page must use node handler builder.')
assert.match(pageSource, /buildPfdDefaultEdgeOptions\(\{/, 'PFD page must use default edge options builder.')
assert.match(pageSource, /buildPfdStyledEdges\(\{/, 'PFD page must use styled edge builder.')
assert.doesNotMatch(pageSource, /const mapped: Node<PfdData>\[\] = nodes\.map/, 'PFD page should not build node handlers inline.')

console.log('pfd flow view model smoke passed')
