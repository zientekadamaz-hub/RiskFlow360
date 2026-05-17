const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const cellsSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-mini-table-cells.tsx'), 'utf8')

assert.match(cellsSource, /export function ExcelTextCell/, 'PFD mini text cell must be exported.')
assert.match(cellsSource, /export function ExcelNumberCell/, 'PFD mini number cell must be exported.')
assert.match(cellsSource, /function ExcelView/, 'PFD mini cells must keep the read-only view helper.')
assert.match(cellsSource, /onKeyDown=\{onKeyDown\}/, 'PFD mini cells must preserve keyboard navigation callback.')
assert.match(cellsSource, /onBlur=\{onBlur\}/, 'PFD mini cells must preserve blur commit callback.')
assert.match(cellsSource, /min=\{1\}/, 'PFD mini number cell must keep minimum score.')
assert.match(cellsSource, /max=\{10\}/, 'PFD mini number cell must keep maximum score.')

assert.match(pageSource, /import \{ ExcelNumberCell, ExcelTextCell \}/, 'PFD page must import mini table cells.')
assert.doesNotMatch(pageSource, /function ExcelTextCell/, 'PFD page should not define ExcelTextCell after extraction.')
assert.doesNotMatch(pageSource, /function ExcelNumberCell/, 'PFD page should not define ExcelNumberCell after extraction.')

console.log('pfd mini table cells smoke passed')
