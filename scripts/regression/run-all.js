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
  return script.startsWith('regression:pfmea:') || script === 'regression:pcp:smoke'
}

function runStep(label, script) {
  const maxAttempts = isBrowserRegression(script) ? 2 : 1

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
    ['Build', 'build'],
    ['PFMEA merge', 'regression:pfmea:merge'],
    ['PFMEA order', 'regression:pfmea:order'],
    ['PFMEA save', 'regression:pfmea:save'],
    ['PCP smoke', 'regression:pcp:smoke'],
  ]

  for (const [label, script] of steps) {
    runStep(label, script)
  }

  process.stdout.write('\n[regression] All regression steps passed.\n')
}

main()
