const fs = require('fs')
const path = require('path')
const cp = require('child_process')

function candidatePathsFromNpmCache() {
  const results = []

  try {
    const cacheDir = cp.execFileSync('npm', ['config', 'get', 'cache'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()

    const npxDir = path.join(cacheDir, '_npx')
    if (!fs.existsSync(npxDir)) return results

    for (const entry of fs.readdirSync(npxDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const playwrightDir = path.join(npxDir, entry.name, 'node_modules', 'playwright')
      if (fs.existsSync(playwrightDir)) {
        results.push(playwrightDir)
      }
    }
  } catch {}

  return results
}

function findPlaywrightPackagePath() {
  const candidates = []

  if (process.env.PLAYWRIGHT_PACKAGE_PATH) {
    candidates.push(process.env.PLAYWRIGHT_PACKAGE_PATH)
  }

  try {
    candidates.push(require.resolve('playwright'))
  } catch {}

  candidates.push(...candidatePathsFromNpmCache())

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))]
  for (const candidate of uniqueCandidates) {
    try {
      require.resolve(candidate)
      return candidate
    } catch {}
  }

  return null
}

function getPlaywright() {
  const packagePath = findPlaywrightPackagePath()
  if (!packagePath) {
    throw new Error(
      'Could not resolve Playwright. Install it locally or run it once with npx so the package exists in npm cache.'
    )
  }
  return require(packagePath)
}

module.exports = {
  findPlaywrightPackagePath,
  getPlaywright,
}
