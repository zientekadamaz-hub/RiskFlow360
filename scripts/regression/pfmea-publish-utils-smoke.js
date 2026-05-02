const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function loadModule(relativePath) {
  const sourcePath = path.join(__dirname, '..', '..', ...relativePath)
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
  return sandbox.module.exports
}

const { isMissingRpcFunctionError, parsePfmeaPublishResult } = loadModule([
  'src',
  'features',
  'pfmea',
  'pfmea-publish-utils.ts',
])

assert.equal(JSON.stringify(parsePfmeaPublishResult('rev-1')), JSON.stringify({ revisionId: 'rev-1', revisionLabel: null }))
assert.equal(
  JSON.stringify(parsePfmeaPublishResult([{ revision_id: 'rev-2', revision_label: '1.2.0' }])),
  JSON.stringify({ revisionId: 'rev-2', revisionLabel: '1.2.0' })
)
assert.equal(JSON.stringify(parsePfmeaPublishResult({ id: 'rev-3' })), JSON.stringify({ revisionId: 'rev-3', revisionLabel: null }))
assert.equal(JSON.stringify(parsePfmeaPublishResult(null)), JSON.stringify({ revisionId: null, revisionLabel: null }))
assert.equal(isMissingRpcFunctionError({ code: 'PGRST202' }, 'publish_pfmea_revision_with_history'), true)
assert.equal(
  isMissingRpcFunctionError({ message: 'Could not find the function public.publish_pfmea_revision_with_history' }, 'publish_pfmea_revision_with_history'),
  true
)
assert.equal(isMissingRpcFunctionError({ message: 'Not authenticated' }, 'publish_pfmea_revision_with_history'), false)

console.log('pfmea publish utils smoke passed')
