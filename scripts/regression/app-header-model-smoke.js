const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', '..', 'src', 'components', 'Layout', 'app-header-model.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText

const sandbox = {
  exports: {},
  module: { exports: {} },
  require,
}
sandbox.exports = sandbox.module.exports
vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })

const {
  buildHeaderAssetPath,
  canSeeAdminFor,
  canSeeSettingsFor,
  adminMenuItems,
  displayFullNameFor,
  displayOrgNameFor,
  displayRoleFor,
  isNoOrgAllowedPath,
  reportsMenuItems,
  settingsMenuItems,
  shouldShowAuthedHeader,
} = sandbox.module.exports

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

assert.equal(shouldShowAuthedHeader(false, 'authed'), false)
assert.equal(shouldShowAuthedHeader(true, 'authed'), true)
assert.equal(shouldShowAuthedHeader(true, 'unknown'), false)

assert.equal(canSeeSettingsFor(true, 'admin', null), true)
assert.equal(canSeeSettingsFor(true, 'engineer', 'champion'), true)
assert.equal(canSeeSettingsFor(true, 'engineer', 'viewer'), false)
assert.equal(canSeeAdminFor(true, 'admin'), true)
assert.equal(canSeeAdminFor(true, 'champion'), false)

assert.equal(displayRoleFor('admin', 'champion'), 'Admin')
assert.equal(displayRoleFor('engineer', 'champion'), 'Champion')
assert.equal(displayRoleFor(null, 'viewer'), 'Viewer')
assert.equal(displayRoleFor(null, null), '')

assert.equal(displayFullNameFor(' Olivia ', ' Zientek '), 'Olivia Zientek')
assert.equal(displayFullNameFor('', ''), null)
assert.equal(displayOrgNameFor('Watlow', 'admin'), null)
assert.equal(displayOrgNameFor(' Watlow ', 'engineer'), 'Watlow')

assert.equal(isNoOrgAllowedPath('/login'), true)
assert.equal(isNoOrgAllowedPath('/waiting-for-invite/token'), true)
assert.equal(isNoOrgAllowedPath('/projects'), false)
assert.equal(buildHeaderAssetPath('/logo.png', ''), '/logo.png')
assert.equal(buildHeaderAssetPath('logo.png', '/base/'), '/base/logo.png')
assert.deepEqual(plain(reportsMenuItems.map((item) => item.href)), ['/reports/rpn-matrix', '/reports/progress-chart'])
assert.equal(settingsMenuItems.some((item) => item.href === '/settings/customer-access'), true)
assert.equal(adminMenuItems.some((item) => item.href === '/settings/organizations'), true)

console.log('app-header model smoke passed')
