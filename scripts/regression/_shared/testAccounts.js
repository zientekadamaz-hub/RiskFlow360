function sanitizeSegment(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
}

function getTestEmailDomain() {
  return process.env.REGRESSION_TEST_EMAIL_DOMAIN?.trim() || 'example.test'
}

function uniqueSeed() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`
}

function buildUniqueEmail(label, runId) {
  const safeLabel = sanitizeSegment(label || 'user') || 'user'
  const safeRunId = sanitizeSegment(runId || uniqueSeed()) || uniqueSeed()
  return `rf360-${safeLabel}-${safeRunId}@${getTestEmailDomain()}`
}

function buildUniqueOrganizationName(label, runId) {
  const safeLabel = sanitizeSegment(label || 'org') || 'org'
  const safeRunId = sanitizeSegment(runId || uniqueSeed()) || uniqueSeed()
  return `RF360 ${safeLabel.toUpperCase()} ${safeRunId}`
}

function buildPassword(label) {
  const safeLabel = sanitizeSegment(label || 'user') || 'user'
  return `Rf360!${safeLabel}9A`
}

module.exports = {
  buildPassword,
  buildUniqueEmail,
  buildUniqueOrganizationName,
}
