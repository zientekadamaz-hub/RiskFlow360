const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'settings', 'invitations', 'page.tsx'), 'utf8')
const headerSource = fs.readFileSync(path.join(root, 'src', 'features', 'settings', 'invitations-table-header.tsx'), 'utf8')

assert.match(headerSource, /export function InvitationsTableHeader/, 'Invitation table header component must be exported.')
assert.match(headerSource, /SettingsFilterColumnHeader/, 'Invitation table header must keep filterable columns.')
assert.match(headerSource, /SettingsActionColumnHeader/, 'Invitation table header must keep sortable action columns.')
assert.match(headerSource, /SettingsHiddenColumnHeader/, 'Invitation table header must keep hidden-column restore affordance.')
assert.match(headerSource, /setHiddenColumns\(\(current\) => \(\{ \.\.\.current, name: false \}\)\)/, 'Invitation table header must restore hidden Name column.')
assert.match(headerSource, /onSort=\{\(direction\) => setSortState\(\{ column: 'created', direction \}\)\}/, 'Invitation table header must sort Created column.')
assert.match(headerSource, /onHideColumn=\{\(\) => setHiddenColumns\(\(current\) => \(\{ \.\.\.current, accepted: true \}\)\)\}/, 'Invitation table header must hide Accepted column.')

assert.match(pageSource, /from '@\/features\/settings\/invitations-table-header'/, 'Invitations page must import extracted table header.')
assert.doesNotMatch(pageSource, /function InvitationsTableHeader/, 'Invitations page should not define table header inline.')
assert.doesNotMatch(pageSource, /SettingsFilterColumnHeader/, 'Invitations page should not import filter header primitives directly.')
assert.match(pageSource, /<InvitationsTableHeader/, 'Invitations page must render extracted table header.')

console.log('settings invitations table header smoke passed')
