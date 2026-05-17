const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'use-pfd-save-controller.ts'), 'utf8')

assert.match(hookSource, /export function usePfdSaveController/, 'PFD save controller hook must be exported.')
assert.match(hookSource, /publishPfdDiagram/, 'PFD save controller must own publish calls.')
assert.match(hookSource, /savePfdWithDescription/, 'PFD save controller must expose save action.')
assert.match(hookSource, /saveDialogOpen/, 'PFD save controller must own save dialog state.')
assert.match(hookSource, /saveDesc/, 'PFD save controller must own save description state.')
assert.match(hookSource, /saveBusy/, 'PFD save controller must own save busy state.')

assert.match(pageSource, /usePfdSaveController\(\{/, 'PFD page must use the save controller hook.')
assert.doesNotMatch(pageSource, /publishPfdDiagram/, 'PFD page should not publish diagrams directly after save controller extraction.')
assert.match(pageSource, /savePfdWithDescription/, 'PFD page must pass save action to the save dialog.')

console.log('pfd save controller smoke passed')
