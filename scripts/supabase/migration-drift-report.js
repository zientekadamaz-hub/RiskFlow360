const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..')
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
const baselinePath = path.join(repoRoot, 'supabase', 'remote-migration-baseline.json')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readLocalMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.sql$/i.test(name))
    .sort()
    .map((fileName) => {
      const version = fileName.slice(0, 14)
      const title = fileName.slice(15).replace(/\.sql$/i, '')
      const fullPath = path.join(migrationsDir, fileName)
      const sql = fs.readFileSync(fullPath, 'utf8')
      return {
        fileName,
        version,
        title,
        flags: classifySql(sql),
      }
    })
}

function classifySql(sql) {
  const normalized = sql.toLowerCase()
  return {
    dropsObjects: /\bdrop\s+(table|view|function|index)\b/.test(normalized),
    dropsPolicies: /\bdrop\s+policy\b/.test(normalized),
    touchesPolicies: /\b(create|alter|drop)\s+policy\b/.test(normalized) || /\brow\s+level\s+security\b/.test(normalized),
    touchesRpcPermissions: /\b(revoke|grant)\s+execute\b/.test(normalized),
    usesSecurityDefiner: /\bsecurity\s+definer\b/.test(normalized),
    createsIndexes: /\bcreate\s+(unique\s+)?index\b/.test(normalized),
    changesConstraints: /\b(add|drop)\s+constraint\b/.test(normalized) || /\bcreate\s+unique\s+index\b/.test(normalized),
    changesFunctions: /\bcreate\s+or\s+replace\s+function\b/.test(normalized),
  }
}

function severityFor(flags) {
  if (flags.touchesPolicies || flags.touchesRpcPermissions || flags.usesSecurityDefiner) return 'High'
  if (flags.dropsObjects || flags.changesConstraints || flags.changesFunctions) return 'Medium'
  if (flags.createsIndexes) return 'Medium'
  return 'Low'
}

function describeFlags(flags) {
  const labels = []
  if (flags.touchesPolicies) labels.push('RLS/policies')
  if (flags.touchesRpcPermissions) labels.push('RPC permissions')
  if (flags.usesSecurityDefiner) labels.push('security definer')
  if (flags.dropsPolicies) labels.push('policy replacements')
  if (flags.createsIndexes) labels.push('indexes')
  if (flags.changesConstraints) labels.push('constraints/unique indexes')
  if (flags.changesFunctions) labels.push('functions')
  if (flags.dropsObjects) labels.push('drops objects')
  return labels.length ? labels.join(', ') : 'schema metadata only'
}

function markdownReport({ baseline, migrations }) {
  const remoteApplied = new Set(baseline.remoteAppliedVersions ?? [])
  const applied = migrations.filter((migration) => remoteApplied.has(migration.version))
  const pending = migrations.filter((migration) => !remoteApplied.has(migration.version))

  const lines = []
  lines.push('# Supabase migration drift report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Baseline observed: ${baseline.observedAt ?? 'unknown'}`)
  lines.push(`Project ref: ${baseline.projectRef ?? 'unknown'}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- local migrations: ${migrations.length}`)
  lines.push(`- applied in remote baseline: ${applied.length}`)
  lines.push(`- pending in remote baseline: ${pending.length}`)
  lines.push('')

  if (!pending.length) {
    lines.push('No migration drift found against the stored remote baseline.')
    lines.push('')
    return lines.join('\n')
  }

  lines.push('## Pending migrations')
  lines.push('')
  lines.push('| Version | Migration | Severity | Why it matters |')
  lines.push('|---|---|---|---|')
  for (const migration of pending) {
    lines.push(`| ${migration.version} | \`${migration.fileName}\` | ${severityFor(migration.flags)} | ${describeFlags(migration.flags)} |`)
  }
  lines.push('')

  lines.push('## Recommended rollout')
  lines.push('')
  lines.push('1. Do not run `npx supabase db push` against the main linked project before backup/staging validation.')
  lines.push('2. Create a Supabase backup or dashboard snapshot of the current project.')
  lines.push('3. Apply pending migrations to a regression/staging project first.')
  lines.push('4. Run `npm run regression:preflight`, `npm run regression:verify-project`, `npm run regression:all`.')
  lines.push('5. Run `npx supabase db lint --linked --schema public --fail-on none` after `SUPABASE_DB_PASSWORD` is set locally.')
  lines.push('6. Deploy to the main project only after staging is green.')
  lines.push('')
  lines.push('## Notes')
  lines.push('')
  lines.push('- This report uses the stored remote baseline and does not connect to Supabase.')
  lines.push('- Refresh `supabase/remote-migration-baseline.json` only after a successful `npx supabase migration list` check.')
  lines.push('- Never commit database passwords, access tokens or service role keys.')
  lines.push('')

  return lines.join('\n')
}

function parseArgs(argv) {
  const args = new Set(argv)
  const writeIndex = argv.indexOf('--write')
  return {
    failOnDrift: args.has('--fail-on-drift'),
    outputPath: writeIndex >= 0 ? argv[writeIndex + 1] : null,
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const baseline = readJson(baselinePath)
  const migrations = readLocalMigrations()
  const report = markdownReport({ baseline, migrations })
  process.stdout.write(`${report}\n`)

  if (options.outputPath) {
    const fullOutputPath = path.resolve(repoRoot, options.outputPath)
    fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true })
    fs.writeFileSync(fullOutputPath, `${report}\n`)
  }

  const remoteApplied = new Set(baseline.remoteAppliedVersions ?? [])
  const pendingCount = migrations.filter((migration) => !remoteApplied.has(migration.version)).length
  if (options.failOnDrift && pendingCount > 0) {
    process.exit(1)
  }
}

main()
