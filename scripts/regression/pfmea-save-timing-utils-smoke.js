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
    Date,
    exports: {},
    module: { exports: {} },
    performance: undefined,
    require,
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath })
  return sandbox.module.exports
}

const { createPfmeaSaveTimer, createPfmeaSaveTimingLogger, formatPfmeaSaveTimings } = loadModule([
  'src',
  'features',
  'pfmea',
  'pfmea-save-timing-utils.ts',
])

let now = 100
const timer = createPfmeaSaveTimer(() => now)
now = 125.04
timer.mark('first')
now = 140.09
timer.mark('second')
now = 150

const summary = timer.summary()
assert.equal(JSON.stringify(summary), JSON.stringify([
  { label: 'first', ms: 25, elapsedMs: 25 },
  { label: 'second', ms: 15, elapsedMs: 40.1 },
  { label: 'total', ms: 9.9, elapsedMs: 50 },
]))
assert.equal(formatPfmeaSaveTimings(summary), 'first: 25 ms (25 ms) | second: 15 ms (40.1 ms) | total: 9.9 ms (50 ms)')

const infoCalls = []
const timingLogger = createPfmeaSaveTimingLogger({
  exposeToWindow: false,
  logger: {
    info: (...args) => infoCalls.push(args),
  },
})
timingLogger.mark('queued')
timingLogger.log('success')
timingLogger.log('ignored')

assert.equal(infoCalls.length, 1)
assert.equal(infoCalls[0][0].startsWith('PFMEA save timings (success): queued:'), true)

console.log('pfmea save timing utils smoke passed')
