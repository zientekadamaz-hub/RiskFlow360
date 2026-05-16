const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfmea', 'page.tsx'), 'utf8')
const shellSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfmea', 'pfmea-table-shell.tsx'), 'utf8')

assert.match(shellSource, /export function PfmeaTableShell/, 'PFMEA table shell component must be exported.')
assert.match(shellSource, /className="pfmeaTable"/, 'PFMEA table shell must keep the pfmeaTable class for existing CSS.')
assert.match(shellSource, /PfmeaTableHeader/, 'PFMEA table shell must render the existing table header.')
assert.match(shellSource, /--pfmea-sticky-cell-top/, 'PFMEA table shell must preserve sticky merged-cell offset.')
assert.match(shellSource, /width: `\$\{visibleTableWidth\}px`/, 'PFMEA table shell must preserve explicit table width.')
assert.match(shellSource, /minWidth: `\$\{visibleTableWidth\}px`/, 'PFMEA table shell must preserve explicit min table width.')
assert.match(shellSource, /\{children\}/, 'PFMEA table shell must render caller-provided table body.')

assert.match(pageSource, /import \{ PfmeaTableShell \}/, 'PFMEA page must use PfmeaTableShell.')
assert.doesNotMatch(pageSource, /import \{ PfmeaTableHeader \}/, 'PFMEA page should not import PfmeaTableHeader directly after shell extraction.')

const shellOpen = pageSource.indexOf('<PfmeaTableShell')
const tbody = pageSource.indexOf('<tbody>', shellOpen)
const shellClose = pageSource.indexOf('</PfmeaTableShell>', shellOpen)
assert.notEqual(shellOpen, -1, 'PFMEA page must render PfmeaTableShell.')
assert.ok(tbody > shellOpen, 'PFMEA table body must remain inside PfmeaTableShell.')
assert.ok(shellClose > tbody, 'PFMEA table body must close before PfmeaTableShell closes.')

console.log('pfmea table shell smoke passed')
