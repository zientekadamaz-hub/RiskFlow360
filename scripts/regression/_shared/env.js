const fs = require('fs')
const path = require('path')

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..')
}

function loadEnvFile(fileName) {
  const envPath = path.join(repoRoot(), fileName)
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || /^\s*#/.test(line) || !line.includes('=')) continue
    const idx = line.indexOf('=')
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!key || process.env[key]) continue
    process.env[key] = value
  }
}

function loadLocalEnv() {
  loadEnvFile('.env.local')
  loadEnvFile('.env.regression.local')
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function getBaseUrl() {
  return process.env.REGRESSION_BASE_URL?.trim() || 'http://localhost:3000'
}

function buildTargetUrl(baseUrl, targetPath) {
  return new URL(targetPath, baseUrl).toString()
}

module.exports = {
  buildTargetUrl,
  getBaseUrl,
  getRequiredEnv,
  loadEnvFile,
  loadLocalEnv,
  repoRoot,
}
