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

  const sandbox = { exports: {}, module: { exports: {} }, require }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const { nextPfmeaRevisionLabel, pfmeaRevisionNumberFromLabel, resolvePfmeaSaveDraftRevisionId } = loadModule(['src', 'features', 'pfmea', 'pfmea-revision-utils.ts'])

assert.equal(pfmeaRevisionNumberFromLabel(null), '-')
assert.equal(pfmeaRevisionNumberFromLabel('0.3.0'), '3')
assert.equal(pfmeaRevisionNumberFromLabel('PFD 2.PFMEA 0.PCP 1'), '2')
assert.equal(nextPfmeaRevisionLabel(null), '0.1.0')
assert.equal(nextPfmeaRevisionLabel('1.4.2'), '1.5.2')
assert.equal(nextPfmeaRevisionLabel('bad.7.x'), '0.8.0')
assert.equal(resolvePfmeaSaveDraftRevisionId({
  currentDraftRevisionId: 'draft-from-project',
  currentOpenRevisionId: 'open',
  draftRevisionIdOverride: 'draft-override',
  workingRevisionId: 'working',
}), 'draft-override')
assert.equal(resolvePfmeaSaveDraftRevisionId({
  currentDraftRevisionId: 'draft-from-project',
  currentOpenRevisionId: 'open',
  draftRevisionIdOverride: null,
  workingRevisionId: 'working',
}), 'draft-from-project')
assert.equal(resolvePfmeaSaveDraftRevisionId({
  currentDraftRevisionId: null,
  currentOpenRevisionId: 'open',
  draftRevisionIdOverride: null,
  workingRevisionId: 'working-draft',
}), 'working-draft')
assert.equal(resolvePfmeaSaveDraftRevisionId({
  currentDraftRevisionId: null,
  currentOpenRevisionId: 'open',
  draftRevisionIdOverride: null,
  workingRevisionId: 'open',
}), null)

console.log('pfmea revision utils smoke passed')
