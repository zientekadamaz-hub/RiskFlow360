const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const saveSourcePath = fs.existsSync(path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'use-pfmea-save-revision.ts'))
  ? path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'use-pfmea-save-revision.ts')
  : path.join(__dirname, '..', '..', 'app', 'pfmea', 'page.tsx')
const postPublishSourcePath = path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'pfmea-save-orchestration.ts')

const saveSource = fs.readFileSync(saveSourcePath, 'utf8')
const postPublishSource = fs.readFileSync(postPublishSourcePath, 'utf8')
const source = `${saveSource}\n${postPublishSource}`

const expectedPrePublishOrder = [
  'auth session',
  'preparePfmeaDraftRowsForPublish',
  'publishPfmeaRevisionForSave',
  'cleanupPfmeaSuccessfulSaveAfterPublish',
]

const expectedDraftPreparationOrder = [
  'preparePfmeaDraftRowsForPublish',
  'editor commit',
  'flush cell updates',
  'flush transient deletes',
  'cleanup empty transient rows',
  'persist dirty draft rows',
  'persist row order metadata',
]

const expectedPostPublishOrder = [
  'sync published row metadata',
  'published integrity check',
  'insert pfmea history fallback',
]

const expectedPublishHelperOrder = [
  'publishPfmeaRevisionForSave',
  'publish revision and history rpc',
  'completePfmeaPostPublish',
]

const expectedSuccessfulCleanupOrder = [
  'setShowSave(false)',
  "setChangeDesc('')",
  'setDirtyPfmeaIds([])',
  'setDeletedPfmeaIds([])',
  'clearDirtyDraftPersisted()',
  'setDraftRevisionIdOverride(null)',
  'resetPfmeaEditRuntimeState()',
  'cleanupPfmeaAfterSuccessfulPublish',
  'cleanup old draft rows',
  'cleanup edit session',
  'setEditSession(null)',
  'forceRefreshExistingDraftFromOpenRef.current = false',
]

const expectedReloadOrder = [
  'cleanupPfmeaSuccessfulSaveAfterPublish',
  'reload project view',
  'reload revision history',
]

let cursor = -1
for (const marker of expectedPrePublishOrder) {
  const nextIndex = saveSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA save flow marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA save flow marker is out of order: ${marker}`)
  cursor = nextIndex
}

cursor = -1
for (const marker of expectedDraftPreparationOrder) {
  const nextIndex = postPublishSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA draft preparation marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA draft preparation marker is out of order: ${marker}`)
  cursor = nextIndex
}

cursor = -1
for (const marker of expectedPostPublishOrder) {
  const nextIndex = postPublishSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA post-publish marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA post-publish marker is out of order: ${marker}`)
  cursor = nextIndex
}

cursor = postPublishSource.indexOf('publishPfmeaRevisionForSave')
assert.notEqual(cursor, -1, 'PFMEA publish helper must exist.')
for (const marker of expectedPublishHelperOrder.slice(1)) {
  const nextIndex = postPublishSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA publish helper marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA publish helper marker is out of order: ${marker}`)
  cursor = nextIndex
}

cursor = postPublishSource.indexOf('cleanupPfmeaSuccessfulSaveAfterPublish')
assert.notEqual(cursor, -1, 'PFMEA successful cleanup helper must exist.')
for (const marker of expectedSuccessfulCleanupOrder) {
  const nextIndex = postPublishSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA successful cleanup marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA successful cleanup marker is out of order: ${marker}`)
  cursor = nextIndex
}

cursor = -1
for (const marker of expectedReloadOrder) {
  const nextIndex = saveSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA save reload marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA save reload marker is out of order: ${marker}`)
  cursor = nextIndex
}

assert.match(source, /commitPfmeaEditorBeforeSave/, 'Save flow must blur/commit the active editor before publishing.')
assert.match(source, /flushPendingCellUpdates/, 'Save flow must flush queued cell updates before publishing.')
assert.match(source, /cleanupPfmeaSuccessfulSaveAfterPublish/, 'Save flow must clean up draft rows and edit session after publish.')

console.log('pfmea save flow smoke passed')
