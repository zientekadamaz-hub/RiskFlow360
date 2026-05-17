const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const panelSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-mini-panel.tsx'), 'utf8')

assert.match(panelSource, /export function PfdMiniPfmeaPanel/, 'PFD mini PFMEA panel must be exported.')
assert.match(panelSource, /ExcelTextCell/, 'PFD mini panel must use extracted text cells.')
assert.match(panelSource, /ExcelNumberCell/, 'PFD mini panel must use extracted number cells.')
assert.match(panelSource, /clampPfmeaMiniScore/, 'PFD mini panel must preserve score clamping.')
assert.match(panelSource, /computePfmeaMiniDerived/, 'PFD mini panel must preserve derived RPN display.')
assert.match(panelSource, /Open full PFMEA/, 'PFD mini panel must preserve full PFMEA link.')
assert.match(panelSource, /No PFMEA rows yet/, 'PFD mini panel must preserve empty state.')

assert.match(pageSource, /import \{ PfdMiniPfmeaPanel \}/, 'PFD page must import mini panel.')
assert.match(pageSource, /<PfdMiniPfmeaPanel[\s\S]*rows=\{pfmeaMiniRows\}[\s\S]*updateMiniCell=\{updateMiniCell\}/,
  'PFD page must pass mini rows and update callback into the mini panel.')
assert.doesNotMatch(pageSource, /No PFMEA rows yet/, 'PFD page should not own mini PFMEA table markup after extraction.')
assert.doesNotMatch(pageSource, /computePfmeaMiniDerived/, 'PFD page should not compute mini PFMEA RPN in JSX after extraction.')

console.log('pfd mini panel smoke passed')
