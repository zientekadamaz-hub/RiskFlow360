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

const {
  CALENDAR_MONTHS,
  CALENDAR_WEEKDAYS,
  formatIsoDate,
  getCalendarCells,
  getDaysInMonth,
  parseIsoDateParts,
} = loadModule(['src', 'features', 'pfmea', 'pfmea-date-utils.ts'])

assert.equal(CALENDAR_WEEKDAYS.length, 7)
assert.equal(CALENDAR_MONTHS[0], 'January')
assert.equal(JSON.stringify(parseIsoDateParts('2026-05-02')), JSON.stringify({ year: 2026, month: 4, day: 2 }))
assert.equal(parseIsoDateParts('2026-5-2'), null)
assert.equal(formatIsoDate(2026, 4, 2), '2026-05-02')
assert.equal(getDaysInMonth(2024, 1), 29)
const may2026 = getCalendarCells(2026, 4)
assert.equal(may2026.length % 7, 0)
assert.equal(may2026.some((cell) => cell.day === 1), true)
assert.equal(may2026.some((cell) => cell.day === 31), true)

console.log('pfmea date utils smoke passed')
