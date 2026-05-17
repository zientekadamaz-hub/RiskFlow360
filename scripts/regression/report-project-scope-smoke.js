const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const helperSource = fs.readFileSync(path.join(root, 'src', 'features', 'reports', 'report-project-scope.ts'), 'utf8')
const rpnServiceSource = fs.readFileSync(path.join(root, 'src', 'features', 'reports', 'rpn-matrix', 'rpn-matrix-service.ts'), 'utf8')
const progressServiceSource = fs.readFileSync(path.join(root, 'src', 'features', 'reports', 'progress-chart', 'progress-chart-service.ts'), 'utf8')

assert.match(helperSource, /export function buildOpenReportProjectScope/, 'Report project scope helper must export project builder.')
assert.match(helperSource, /normalizeProjectText\(project\.status\)\.toUpperCase\(\) === 'OPEN'/, 'Report project scope helper must keep OPEN-only project scope.')
assert.match(helperSource, /getReportRevisionId\(project\)/, 'Report project scope helper must use shared report revision selection.')
assert.match(helperSource, /requireRevision/, 'Report project scope helper must support revision-required reports.')
assert.match(helperSource, /includeProjectFilter/, 'Report project scope helper must support project option lists independent of selected project filter.')
assert.match(helperSource, /export function normalizeReportOptionList/, 'Report project scope helper must export option list normalizer.')

assert.match(rpnServiceSource, /buildOpenReportProjectScope/, 'RPN Matrix service must use shared project scope helper.')
assert.match(rpnServiceSource, /requireRevision: true/, 'RPN Matrix service must require revision-backed open projects.')
assert.match(rpnServiceSource, /normalizeReportOptionList/, 'RPN Matrix service must use shared option list normalizer.')
assert.doesNotMatch(rpnServiceSource, /function buildProjectRows/, 'RPN Matrix service should not keep duplicated project row builder.')

assert.match(progressServiceSource, /buildOpenReportProjectScope/, 'Progress Chart service must use shared project scope helper.')
assert.doesNotMatch(progressServiceSource, /normalizeProjectText\(project\.status\)/, 'Progress Chart service should not duplicate OPEN project filtering.')
assert.doesNotMatch(progressServiceSource, /getReportRevisionId\(project\)/, 'Progress Chart service should not duplicate revision selection.')

console.log('report project scope smoke passed')
