const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'use-pfd-canvas-data-controller.ts'), 'utf8')

assert.match(hookSource, /export function usePfdCanvasDataController/, 'PFD canvas data controller hook must be exported.')
assert.match(hookSource, /fetchPfdCanvasData/, 'PFD canvas data controller must own canvas loading.')
assert.match(hookSource, /fetchOwnPfdDraft/, 'PFD canvas data controller must own draft loading.')
assert.match(hookSource, /savePfdDraft/, 'PFD canvas data controller must own draft autosave.')
assert.match(hookSource, /sanitizeNodes/, 'PFD canvas data controller must sanitize nodes.')
assert.match(hookSource, /sanitizeEdges/, 'PFD canvas data controller must sanitize edges.')
assert.match(hookSource, /resetDraftLoad/, 'PFD canvas data controller must expose draft reload reset.')

assert.match(pageSource, /usePfdCanvasDataController\(\{/, 'PFD page must use the canvas data controller hook.')
assert.doesNotMatch(pageSource, /fetchPfdCanvasData/, 'PFD page should not fetch canvas data directly after canvas controller extraction.')
assert.doesNotMatch(pageSource, /fetchOwnPfdDraft/, 'PFD page should not fetch drafts directly after canvas controller extraction.')
assert.doesNotMatch(pageSource, /savePfdDraft/, 'PFD page should not autosave drafts directly after canvas controller extraction.')
assert.match(pageSource, /resetDraftLoad\(\)/, 'PFD page must reset draft loading when starting or discarding an edit session.')

console.log('pfd canvas data controller smoke passed')
