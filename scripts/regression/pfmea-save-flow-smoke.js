const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const saveSourcePath = fs.existsSync(path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'use-pfmea-save-revision.ts'))
  ? path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'use-pfmea-save-revision.ts')
  : path.join(__dirname, '..', '..', 'app', 'pfmea', 'page.tsx')
const postPublishSourcePath = path.join(__dirname, '..', '..', 'src', 'features', 'pfmea', 'pfmea-save-orchestration.ts')
const pageSourcePath = path.join(__dirname, '..', '..', 'app', 'pfmea', 'page.tsx')

const saveSource = fs.readFileSync(saveSourcePath, 'utf8')
const postPublishSource = fs.readFileSync(postPublishSourcePath, 'utf8')
const pageSource = fs.readFileSync(pageSourcePath, 'utf8')
const source = `${saveSource}\n${postPublishSource}`

const expectedPrePublishOrder = [
  'validatePfmeaSaveStart',
  'validation.status ===',
  'auth session',
  'resolve fresh draft revision',
  'preparePfmeaDraftRowsForPublish',
  'publishPfmeaRevisionForSave',
  'cleanupPfmeaSuccessfulSaveAfterPublish',
  'completePfmeaSuccessfulSaveReload',
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
  'completePfmeaSuccessfulSaveReload',
]

const expectedSuccessfulReloadOrder = [
  'completePfmeaSuccessfulSaveReload',
  'Published PFMEA revision id',
  'loadProjectView()',
  'reload project view',
  'loadRevisionHistory()',
  'reload revision history',
  'integrityWarning',
  'postPublishWarning',
]

const expectedStartValidationOrder = [
  'validatePfmeaSaveStart',
  "status: 'busy'",
  "status: 'clean'",
  'Change description is required.',
  'resolvePfmeaSaveDraftRevisionId',
  'No draft revision found.',
  "status: 'ready'",
]

let cursor = -1
for (const marker of expectedPrePublishOrder) {
  const nextIndex = saveSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA save flow marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA save flow marker is out of order: ${marker}`)
  cursor = nextIndex
}

cursor = postPublishSource.indexOf('validatePfmeaSaveStart')
assert.notEqual(cursor, -1, 'PFMEA save start validation helper must exist.')
for (const marker of expectedStartValidationOrder.slice(1)) {
  const nextIndex = postPublishSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA save start validation marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA save start validation marker is out of order: ${marker}`)
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

cursor = postPublishSource.indexOf('completePfmeaSuccessfulSaveReload')
assert.notEqual(cursor, -1, 'PFMEA successful reload helper must exist.')
for (const marker of expectedSuccessfulReloadOrder.slice(1)) {
  const nextIndex = postPublishSource.indexOf(marker, cursor + 1)
  assert.notEqual(nextIndex, -1, `Missing PFMEA successful reload marker: ${marker}`)
  assert.ok(nextIndex > cursor, `PFMEA successful reload marker is out of order: ${marker}`)
  cursor = nextIndex
}

assert.match(source, /commitPfmeaEditorBeforeSave/, 'Save flow must blur/commit the active editor before publishing.')
assert.match(source, /flushPendingCellUpdates/, 'Save flow must flush queued cell updates before publishing.')
assert.match(source, /cleanupPfmeaSuccessfulSaveAfterPublish/, 'Save flow must clean up draft rows and edit session after publish.')
assert.match(source, /validatePfmeaSaveStart/, 'Save flow must validate initial save state before publishing.')
assert.match(saveSource, /params\.loadProjectView\(\{ syncDraftOverride: false \}\)[\s\S]*freshProjectView\.current_draft_revision_id[\s\S]*params\.setDraftRevisionIdOverride\(freshDraftRevisionId\)/, 'Save flow must revalidate the fresh draft revision before publishing.')
assert.match(saveSource, /if \(!freshDraftRevisionId\) \{[\s\S]*ensurePfmeaProcessDraft\(params\.supabase, params\.projectId, uid\)[\s\S]*ensure fresh draft revision[\s\S]*No draft revision found\./, 'Save flow must create or resolve a server-side draft before publish instead of letting the publish RPC create an unprepared draft.')
assert.match(saveSource, /activeSaveDraftRevisionIdRef\.current \?\? params\.draftRevisionIdOverride/, 'Published metadata sync must use the fresh draft revision during save.')
assert.match(saveSource, /restoreSnapshotToRevision: restorePfmeaSnapshotToRevision/, 'Draft remap must be able to rebuild a stale draft revision from the current snapshot.')
assert.match(pageSource, /moduleAccessState !== 'allowed'\) \{\s*return <PfmeaPageFallback \/>/, 'PFMEA must render a dark fallback while access is checking instead of returning null.')
assert.match(pageSource, /function PfmeaPageFallback\(\)[\s\S]*<SettingsBackdrop \/>/, 'PFMEA fallback must use the same textured backdrop instead of a flat loading screen.')
assert.doesNotMatch(pageSource, /Loading PFMEA/, 'PFMEA fallback must avoid visible loading text flashes between modules.')
assert.match(
  postPublishSource,
  /ensurePublishedPfmeaIntegrityAfterSave[\s\S]*findEquivalentPublishedPfmeaRow/,
  'Post-publish integrity check must use published-row matching to avoid false safety restores.'
)
assert.match(
  postPublishSource,
  /waitForSaveConsistency[\s\S]*checkSnapshot\(\)[\s\S]*if \(missingRows\.length === 0\) return null[\s\S]*restoreSnapshotToRevision/,
  'Post-publish integrity check must retry once before restoring from the safety snapshot.'
)
assert.match(
  postPublishSource,
  /missingRows\.length > 0 && params\.restoreSnapshotToRevision[\s\S]*restoreSnapshotToRevision\(params\.revisionId, snapshotRows\)[\s\S]*mapSnapshotRows\(restoredRows\)/,
  'PFMEA save must rebuild and remap the draft snapshot when stale draft rows cannot be matched.'
)

console.log('pfmea save flow smoke passed')
