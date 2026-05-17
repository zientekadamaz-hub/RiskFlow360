const { getBaseUrl, loadLocalEnv } = require('./_shared/env')

const REQUIRED_BROWSER_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'REGRESSION_EMAIL',
  'REGRESSION_PASSWORD',
  'PFMEA_REGRESSION_PROJECT_ID',
]

const OPTIONAL_BROWSER_ENV = [
  'PCP_REGRESSION_PROJECT_ID',
  'REGRESSION_ADMIN_EMAIL',
  'REGRESSION_ADMIN_PASSWORD',
  'REGRESSION_TEST_EMAIL_DOMAIN',
]

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function checkBaseUrl(baseUrl) {
  try {
    const response = await fetch(baseUrl, { method: 'GET' })
    return {
      ok: response.ok,
      status: response.status,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  loadLocalEnv()

  const failures = []
  const warnings = []

  for (const name of REQUIRED_BROWSER_ENV) {
    const value = process.env[name]?.trim()
    if (!value) failures.push(`Missing required env: ${name}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (supabaseUrl && !isHttpUrl(supabaseUrl)) failures.push('NEXT_PUBLIC_SUPABASE_URL must be an http(s) URL.')

  const baseUrl = getBaseUrl()
  if (!isHttpUrl(baseUrl)) {
    failures.push('REGRESSION_BASE_URL must be an http(s) URL.')
  }

  for (const name of ['PFMEA_REGRESSION_PROJECT_ID', 'PCP_REGRESSION_PROJECT_ID']) {
    const value = process.env[name]?.trim()
    if (value && !isLikelyUuid(value)) warnings.push(`${name} does not look like a UUID. Verify the project id.`)
  }

  const missingOptional = OPTIONAL_BROWSER_ENV.filter((name) => !process.env[name]?.trim())
  if (missingOptional.length) {
    warnings.push(`Optional env not set: ${missingOptional.join(', ')}`)
  }

  if (isHttpUrl(baseUrl) && process.env.REGRESSION_PREFLIGHT_SKIP_URL !== '1') {
    const urlCheck = await checkBaseUrl(baseUrl)
    if (!urlCheck.ok) {
      warnings.push(
        urlCheck.error
          ? `Regression app URL is not reachable yet (${baseUrl}): ${urlCheck.error}`
          : `Regression app URL responded with HTTP ${urlCheck.status} (${baseUrl}).`
      )
    }
  }

  for (const warning of warnings) {
    process.stdout.write(`[regression:preflight] WARNING: ${warning}\n`)
  }

  if (failures.length) {
    for (const failure of failures) {
      process.stderr.write(`[regression:preflight] ERROR: ${failure}\n`)
    }
    process.exit(1)
  }

  process.stdout.write('[regression:preflight] Browser regression environment looks usable.\n')
  process.stdout.write(`[regression:preflight] Base URL: ${baseUrl}\n`)
  process.stdout.write(`[regression:preflight] PFMEA project: ${process.env.PFMEA_REGRESSION_PROJECT_ID?.trim()}\n`)
  if (process.env.PCP_REGRESSION_PROJECT_ID?.trim()) {
    process.stdout.write(`[regression:preflight] PCP project: ${process.env.PCP_REGRESSION_PROJECT_ID.trim()}\n`)
  }
}

main().catch((error) => {
  process.stderr.write(`[regression:preflight] ERROR: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
