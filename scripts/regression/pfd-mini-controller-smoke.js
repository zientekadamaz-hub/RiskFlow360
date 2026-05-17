const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const hookSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'use-pfd-mini-pfmea-controller.ts'), 'utf8')

assert.match(hookSource, /export function usePfdMiniPfmeaController/, 'PFD mini PFMEA controller hook must be exported.')
assert.match(hookSource, /fetchPfmeaMiniRows/, 'PFD mini PFMEA controller must load mini rows.')
assert.match(hookSource, /createPfmeaMiniRow/, 'PFD mini PFMEA controller must add mini rows.')
assert.match(hookSource, /updatePfmeaMiniRow/, 'PFD mini PFMEA controller must update mini rows.')
assert.match(hookSource, /event\.key === 'Tab'/, 'PFD mini PFMEA controller must preserve Tab navigation.')
assert.match(hookSource, /event\.key === 'Escape'/, 'PFD mini PFMEA controller must preserve Escape behavior.')

assert.match(pageSource, /usePfdMiniPfmeaController\(/, 'PFD page must use the mini PFMEA controller hook.')
assert.match(pageSource, /loadRowsForOperation\(operationId\)/, 'PFD page must load mini rows through the controller.')
assert.doesNotMatch(pageSource, /fetchPfmeaMiniRows/, 'PFD page should not fetch mini PFMEA rows directly after controller extraction.')
assert.doesNotMatch(pageSource, /createPfmeaMiniRow/, 'PFD page should not create mini PFMEA rows directly after controller extraction.')
assert.doesNotMatch(pageSource, /updatePfmeaMiniRow/, 'PFD page should not update mini PFMEA rows directly after controller extraction.')

console.log('pfd mini controller smoke passed')
