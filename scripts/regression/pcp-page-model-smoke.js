const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pcp', 'page.tsx'), 'utf8')
const modelSource = fs.readFileSync(path.join(root, 'src', 'features', 'pcp', 'pcp-page-model.ts'), 'utf8')

assert.match(modelSource, /export type PcpColumnId/, 'PCP page model must export column ids.')
assert.match(modelSource, /export const PCP_COLUMNS/, 'PCP page model must export table columns.')
assert.match(modelSource, /export const DEFAULT_VISIBLE_COLUMNS/, 'PCP page model must export default visible columns.')
assert.match(modelSource, /export const EDIT_LOCK_MS/, 'PCP page model must export edit lock timeout.')
assert.match(modelSource, /export function makePcpPlaceholderRow/, 'PCP page model must export placeholder row factory.')
assert.match(modelSource, /export function anchoredPopupStyle/, 'PCP page model must export popup positioning helper.')
assert.match(modelSource, /export function formatDateTimePL/, 'PCP page model must export history date formatter.')

assert.match(pageSource, /from '@\/features\/pcp\/pcp-page-model'/, 'PCP page must import shared page model.')
assert.doesNotMatch(pageSource, /type PcpColumnId =/, 'PCP page should not define column ids inline.')
assert.doesNotMatch(pageSource, /const PCP_COLUMNS: Array/, 'PCP page should not define table columns inline.')
assert.doesNotMatch(pageSource, /function makePcpPlaceholderRow/, 'PCP page should not define placeholder factory inline.')

function loadTypeScriptModule(relativePath, moduleMap = {}) {
  const sourcePath = path.join(root, ...relativePath)
  const source = fs.readFileSync(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText

  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(moduleMap, request)) return moduleMap[request]
      return require(request)
    },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const pcpUtils = loadTypeScriptModule(['src', 'features', 'pcp', 'pcp-utils.ts'])
const model = loadTypeScriptModule(['src', 'features', 'pcp', 'pcp-page-model.ts'], {
  './pcp-utils': pcpUtils,
  './pcp-service': {},
})

assert.equal(model.PCP_COLUMNS.length, 15)
assert.equal(model.DEFAULT_VISIBLE_COLUMNS.reaction_plan, true)
assert.equal(model.formatDateTimePL(null), '-')
const placeholder = model.makePcpPlaceholderRow(
  { id: 'op-1', project_id: 'project-1', operation_number: 10, name: 'Assembly', machine: 'Line 1', operation: 'Fit' },
  'rev-1',
  'op-1:seed-1',
  { id: 'seed-1', failure_mode: 'Leak', characteristic: 'Torque', class: 'special characteristic', severity: '9', rpn: 300 }
)
assert.equal(placeholder.id, `${pcpUtils.PCP_PLACEHOLDER_PREFIX}op-1:seed-1`)
assert.equal(placeholder.revision_id, 'rev-1')
assert.equal(placeholder.class, 'SC')
assert.equal(placeholder.severity, 9)

console.log('pcp page model smoke passed')
