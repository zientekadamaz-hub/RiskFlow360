const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const sharedSource = fs.readFileSync(path.join(root, 'src', 'features', 'reports', 'report-filter-select.tsx'), 'utf8')
const rpnPageSource = fs.readFileSync(path.join(root, 'src', 'features', 'reports', 'rpn-matrix', 'RpnMatrixReportPage.tsx'), 'utf8')
const progressPageSource = fs.readFileSync(path.join(root, 'src', 'features', 'reports', 'progress-chart', 'ProgressChartReportPage.tsx'), 'utf8')

assert.match(sharedSource, /export function ReportFilterSelect/, 'Shared report filter select must be exported.')
assert.match(sharedSource, /StandardSelect/, 'Shared report filter select must keep standard select control.')
assert.match(sharedSource, /settingsInputStyle/, 'Shared report filter select must keep standard input styling.')
assert.match(sharedSource, /allLabel \? \[\{ label: allLabel, value: '' \}/, 'Shared report filter select must support all-option prepending.')
assert.match(sharedSource, /disabled=\{disabled\}/, 'Shared report filter select must forward disabled state.')

assert.match(rpnPageSource, /ReportFilterSelect/, 'RPN Matrix report must use shared report filter select.')
assert.match(progressPageSource, /ReportFilterSelect/, 'Progress Chart report must use shared report filter select.')
assert.doesNotMatch(rpnPageSource, /function FilterSelect/, 'RPN Matrix report should not define local filter select.')
assert.doesNotMatch(progressPageSource, /function FilterSelect/, 'Progress Chart report should not define local filter select.')
assert.doesNotMatch(rpnPageSource, /StandardSelect/, 'RPN Matrix report should not import StandardSelect directly.')
assert.doesNotMatch(progressPageSource, /StandardSelect/, 'Progress Chart report should not import StandardSelect directly.')

console.log('report filter select smoke passed')
