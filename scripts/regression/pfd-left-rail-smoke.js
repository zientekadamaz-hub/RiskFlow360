const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const railSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-left-rail.tsx'), 'utf8')

assert.match(railSource, /export function PfdLeftRail/, 'PFD left rail component must be exported.')
assert.match(railSource, /PaletteButton/, 'PFD left rail must render the symbol palette.')
assert.match(railSource, /Discard draft/, 'PFD left rail must preserve edit-session action labels.')
assert.match(railSource, /Save PFD/, 'PFD left rail must preserve save action.')
assert.match(railSource, /PFD history/, 'PFD left rail must preserve history action.')
assert.match(railSource, /Lasso: ON/, 'PFD left rail must preserve lasso toggle labels.')
assert.match(railSource, /onAddOperationAfterSelected/, 'PFD left rail must preserve insert-after callback.')
assert.match(railSource, /onResequenceOperations/, 'PFD left rail must preserve resequence callback.')

assert.match(pageSource, /import \{ PfdLeftRail \}/, 'PFD page must import left rail component.')
assert.match(pageSource, /<PfdLeftRail[\s\S]*onAddOperationAfterSelected=\{addOperationAfterSelected\}[\s\S]*onZoomStep=\{setZoomByStep\}/, 'PFD page must delegate left rail rendering and callbacks.')
assert.doesNotMatch(pageSource, /function ThumbOperation/, 'PFD page should not own palette thumbnails after left rail extraction.')
assert.doesNotMatch(pageSource, /PaletteButton/, 'PFD page should not render palette buttons after left rail extraction.')

console.log('pfd left rail smoke passed')
