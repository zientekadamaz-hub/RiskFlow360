const { spawnSync } = require('child_process')

function commandForScript(script) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/c', 'npm', 'run', script],
    }
  }

  return {
    command: 'npm',
    args: ['run', script],
  }
}

function isBrowserRegression(script) {
  return script.startsWith('regression:pfmea:') || script === 'regression:pcp:smoke' || script === 'regression:pcp:save'
}

function getMaxAttempts(script) {
  if (!isBrowserRegression(script)) return 1
  const configured = Number.parseInt(process.env.REGRESSION_BROWSER_ATTEMPTS || '', 10)
  return Number.isFinite(configured) && configured > 0 ? configured : 2
}

function runStep(label, script) {
  const maxAttempts = getMaxAttempts(script)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    process.stdout.write(`\n[regression] ${label}${maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ''}\n`)
    const { command, args } = commandForScript(script)
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      env: process.env,
    })

    if (result.error) {
      throw result.error
    }

    if (result.status === 0) {
      return
    }

    if (attempt < maxAttempts) {
      process.stdout.write(`[regression] ${label} failed, retrying once...\n`)
      continue
    }

    process.exit(typeof result.status === 'number' ? result.status : 1)
  }
}

function main() {
  const steps = [
    ['PFMEA merge', 'regression:pfmea:merge'],
    ['PFMEA save', 'regression:pfmea:save'],
    ['PCP smoke', 'regression:pcp:smoke'],
    ['PCP save', 'regression:pcp:save'],
  ]

  if (process.env.REGRESSION_SKIP_PFMEA_ORDER !== '1') {
    steps.splice(1, 0, ['PFMEA order', 'regression:pfmea:order'])
  }

  if (process.env.REGRESSION_SKIP_BUILD !== '1') {
    steps.unshift(['Build', 'build'])
  }

  for (const [label, script] of steps) {
    runStep(label, script)
  }

  process.stdout.write('\n[regression] All regression steps passed.\n')
}

main()
