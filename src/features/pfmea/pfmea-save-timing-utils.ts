export type PfmeaSaveTimingEntry = {
  label: string
  ms: number
  elapsedMs: number
}

type NowFn = () => number

function defaultNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now()
  return Date.now()
}

function roundMs(value: number) {
  return Math.round(value * 10) / 10
}

export function createPfmeaSaveTimer(now: NowFn = defaultNow) {
  const start = now()
  let previous = start
  const entries: PfmeaSaveTimingEntry[] = []

  return {
    mark(label: string) {
      const current = now()
      entries.push({
        label,
        ms: roundMs(Math.max(0, current - previous)),
        elapsedMs: roundMs(Math.max(0, current - start)),
      })
      previous = current
    },
    summary() {
      const current = now()
      return [
        ...entries,
        {
          label: 'total',
          ms: roundMs(Math.max(0, current - previous)),
          elapsedMs: roundMs(Math.max(0, current - start)),
        },
      ]
    },
  }
}

export function formatPfmeaSaveTimings(entries: PfmeaSaveTimingEntry[]) {
  return entries.map((entry) => `${entry.label}: ${entry.ms} ms (${entry.elapsedMs} ms)`).join(' | ')
}

export function createPfmeaSaveTimingLogger(options?: {
  exposeToWindow?: boolean
  logger?: Pick<Console, 'info'>
}) {
  const timer = createPfmeaSaveTimer()
  const logger = options?.logger ?? console
  let logged = false

  const log = (status: string) => {
    if (logged) return
    logged = true
    const timings = timer.summary()
    if (options?.exposeToWindow !== false && typeof window !== 'undefined') {
      ;(window as Window & { __RF360_LAST_PFMEA_SAVE_TIMINGS?: PfmeaSaveTimingEntry[] }).__RF360_LAST_PFMEA_SAVE_TIMINGS = timings
    }
    logger.info(`PFMEA save timings (${status}): ${formatPfmeaSaveTimings(timings)}`, timings)
  }

  return {
    log,
    mark: timer.mark,
    timer,
  }
}
