const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'settings', 'sites-departments', 'page.tsx'), 'utf8')
const headerSource = fs.readFileSync(path.join(root, 'src', 'features', 'settings', 'site-departments-table-header.tsx'), 'utf8')

assert.match(headerSource, /export function SitesDepartmentsTableHeader/, 'Site departments table header must be exported.')
assert.match(headerSource, /SettingsFilterColumnHeader/, 'Site departments table header must keep filterable headers.')
assert.match(headerSource, /SettingsHiddenColumnHeader/, 'Site departments table header must keep hidden-column restore affordance.')
assert.match(headerSource, /SettingsActionColumnHeader/, 'Site departments table header must keep actions sort header.')
assert.match(headerSource, /onSort=\{\(direction\) => setSortState\(\{ column: 'departments', direction \}\)\}/, 'Departments header must sort by departments.')
assert.match(headerSource, /onHideColumn=\{\(\) => setHiddenColumns\(\(current\) => \(\{ \.\.\.current, usage: true \}\)\)\}/, 'Usage header must be hideable.')

assert.match(pageSource, /from '@\/features\/settings\/site-departments-table-header'/, 'Sites departments page must import extracted table header.')
assert.doesNotMatch(pageSource, /function SitesDepartmentsTableHeader/, 'Sites departments page should not define table header inline.')
assert.doesNotMatch(pageSource, /SettingsFilterColumnHeader/, 'Sites departments page should not import column filter primitives directly.')
assert.match(pageSource, /<SitesDepartmentsTableHeader/, 'Sites departments page must render extracted table header.')

console.log('settings site departments table header smoke passed')
