const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const canvasSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-flow-canvas.tsx'), 'utf8')

assert.match(canvasSource, /export function PfdFlowCanvas/, 'PFD flow canvas component must be exported.')
assert.match(canvasSource, /<PfdRightNav projectId=\{projectId\} \/>/, 'PFD flow canvas must keep the right navigation inside the flow area.')
assert.match(canvasSource, /<ReactFlow/, 'PFD flow canvas must render ReactFlow.')
assert.match(canvasSource, /connectionRadius=\{Math\.round\(HIT \* 1\.6\)\}/, 'PFD flow canvas must preserve connection radius.')
assert.match(canvasSource, /selectionOnDrag=\{lassoEnabled && isEditOwner\}/, 'PFD flow canvas must preserve lasso selection behavior.')
assert.match(canvasSource, /<MiniMap \/>/, 'PFD flow canvas must preserve minimap.')
assert.match(canvasSource, /<Background \/>/, 'PFD flow canvas must preserve background.')

assert.match(pageSource, /import \{ PfdFlowCanvas \}/, 'PFD page must import flow canvas component.')
assert.match(pageSource, /<PfdFlowCanvas[\s\S]*onInit=\{\(inst\) =>/, 'PFD page must keep ReactFlow init behavior at the orchestration level.')
assert.doesNotMatch(pageSource, /<ReactFlow[\s>]/, 'PFD page should not own ReactFlow JSX after extraction.')

console.log('pfd flow canvas smoke passed')
