const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const sourcePath = path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'pfmea-text-cell.tsx')
const source = fs.readFileSync(sourcePath, 'utf8')

assert.match(
  source,
  /initialEditValueRef/,
  'TdText must remember the value from the moment editing starts.'
)
assert.doesNotMatch(
  source,
  /nextVal\s*!==\s*\(props\.value\s*\?\?\s*''\)/,
  'TdText must not compare blur value against live props.value, because pending display values can change during edit.'
)
assert.match(
  source,
  /nextVal\s*!==\s*initialEditValueRef\.current/,
  'TdText blur commit must compare against the initial edit value.'
)
assert.match(
  source,
  /defaultValue=\{val\}/,
  'TdText editor must seed its initial DOM value when editing starts.'
)
assert.doesNotMatch(
  source,
  /value=\{val\}/,
  'TdText editor must not be controlled by live props while editing.'
)
assert.doesNotMatch(
  source,
  /setDraftValue/,
  'TdText must not call setState from effects to seed draft values.'
)

console.log('pfmea text cell smoke passed')
