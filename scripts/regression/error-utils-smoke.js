const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', '..', 'src', 'lib', 'error-utils.ts')
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

const { classifyAppError, errorText, isTimeoutError, toAppError, toUserErrorMessage } = sandbox.module.exports

assert.equal(errorText(null), 'unknown')
assert.equal(errorText(null, 'fallback'), 'fallback')
assert.equal(errorText(new Error('plain failure')), 'plain failure')
assert.equal(errorText({ message: 'message wins', details: 'details' }), 'message wins')
assert.equal(errorText({ message: { details: 'nested details', code: 'P0001' } }), 'nested details')
assert.equal(errorText({ message: { code: 'P0001' } }), 'P0001')
assert.notEqual(errorText({ message: { details: 'nested details' } }), '[object Object]')
assert.equal(errorText({ error_description: 'description' }), 'description')
assert.equal(errorText({ details: 'details' }), 'details')
assert.equal(errorText({ hint: 'hint' }), 'hint')
assert.equal(errorText({ name: 'NamedError' }), 'NamedError')
assert.equal(errorText('raw'), 'raw')
assert.equal(isTimeoutError({ message: 'Query timeout after 1800ms' }), true)
assert.equal(isTimeoutError({ message: 'Permission denied' }), false)
assert.equal(classifyAppError({ message: 'Cannot read user: Not authenticated.' }), 'auth')
assert.equal(classifyAppError({ message: 'Process name already exists.' }), 'conflict')
assert.equal(classifyAppError({ message: 'permission denied for table projects' }), 'permission')
assert.equal(classifyAppError({ message: 'null value in column organization_id violates not-null constraint' }), 'database')
assert.equal(classifyAppError({ message: 'Failed to fetch' }), 'network')
assert.equal(classifyAppError({ message: 'Query timeout after 1800ms' }), 'timeout')
assert.equal(toAppError({ message: 'No signed-in user.' }).kind, 'auth')
assert.equal(toUserErrorMessage(null, 'Fallback message.'), 'Fallback message.')

console.log('error-utils smoke passed')
