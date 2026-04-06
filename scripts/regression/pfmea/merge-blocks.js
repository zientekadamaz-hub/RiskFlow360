function asInt1to10(value) {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : value
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null
}

function isPlaceholderRowId(id) {
  return String(id || '').startsWith('__pfmea_placeholder__:')
}

function buildFailureBlockMergeInfo(tableRows) {
  const spans = tableRows.map(() => ({ span: 0, end: 0 }))

  function getFailureBlockSourceRowAtIndex(rowIndex) {
    const effectiveRow = tableRows[rowIndex] ?? {}
    if ((effectiveRow.effect ?? '').trim() && asInt1to10(effectiveRow.severity) != null) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = tableRows[i]
      if ((candidate.operation_id || candidate.operations?.id || null) !== opId) break
      if ((candidate.failure_mode ?? '').trim() !== failureMode) break
      if ((candidate.effect ?? '').trim() && asInt1to10(candidate.severity) != null) return candidate
    }
    return effectiveRow
  }

  function keyOf(rowIndex) {
    const r = getFailureBlockSourceRowAtIndex(rowIndex)
    const failureMode = (r.failure_mode ?? '').trim()
    const effect = (r.effect ?? '').trim()
    const sev = asInt1to10(r.severity)
    if (!failureMode || !effect || sev == null) return null

    const opKey = [
      r.operation_id ?? r.operations?.id ?? '',
      r.operations?.operation_number ?? '',
      r.operations?.machine ?? '',
      r.operations?.operation ?? '',
      r.operations?.name ?? '',
    ].join('|')
    return `${opKey}|${failureMode}|${effect}|${sev}`
  }

  let i = 0
  while (i < tableRows.length) {
    const row = tableRows[i]
    if (isPlaceholderRowId(row.id)) {
      spans[i] = { span: 1, end: i }
      i += 1
      continue
    }

    const key = keyOf(i)
    if (!key) {
      spans[i] = { span: 1, end: i }
      i += 1
      continue
    }

    let j = i + 1
    while (j < tableRows.length) {
      const next = tableRows[j]
      if (isPlaceholderRowId(next.id)) break
      if (keyOf(j) !== key) break
      j += 1
    }
    for (let k = i; k < j; k += 1) spans[k] = { span: k === i ? j - i : 0, end: j - 1 }
    i = j
  }

  return spans
}

function buildActionPlanBlockMergeInfo(tableRows) {
  const spans = tableRows.map(() => ({ span: 0, end: 0 }))

  function getActionPlanBlockSourceRowAtIndex(rowIndex) {
    const effectiveRow = tableRows[rowIndex] ?? {}
    const hasCurrentRiskBlock =
      !!(effectiveRow.effect ?? '').trim() &&
      asInt1to10(effectiveRow.severity) != null &&
      !!(effectiveRow.cause ?? '').trim() &&
      asInt1to10(effectiveRow.occurrence) != null &&
      !!(effectiveRow.current_prevention ?? '').trim() &&
      !!(effectiveRow.current_detection ?? '').trim() &&
      asInt1to10(effectiveRow.detection) != null

    if (hasCurrentRiskBlock) return effectiveRow

    const opId = effectiveRow.operation_id || effectiveRow.operations?.id || null
    const failureMode = (effectiveRow.failure_mode ?? '').trim()
    for (let i = rowIndex - 1; i >= 0; i -= 1) {
      const candidate = tableRows[i]
      if ((candidate.operation_id || candidate.operations?.id || null) !== opId) break
      if ((candidate.failure_mode ?? '').trim() !== failureMode) break

      const candidateHasCurrentRiskBlock =
        !!(candidate.effect ?? '').trim() &&
        asInt1to10(candidate.severity) != null &&
        !!(candidate.cause ?? '').trim() &&
        asInt1to10(candidate.occurrence) != null &&
        !!(candidate.current_prevention ?? '').trim() &&
        !!(candidate.current_detection ?? '').trim() &&
        asInt1to10(candidate.detection) != null

      if (candidateHasCurrentRiskBlock) return candidate
    }

    return effectiveRow
  }

  function keyOf(rowIndex) {
    const r = getActionPlanBlockSourceRowAtIndex(rowIndex)
    const failureMode = (r.failure_mode ?? '').trim()
    const effect = (r.effect ?? '').trim()
    const sev = asInt1to10(r.severity)
    const cause = (r.cause ?? '').trim()
    const occ = asInt1to10(r.occurrence)
    const currentPrev = (r.current_prevention ?? '').trim()
    const currentDet = (r.current_detection ?? '').trim()
    const det = asInt1to10(r.detection)
    if (!failureMode || !effect || sev == null || !cause || occ == null || !currentPrev || !currentDet || det == null) return null

    const opKey = [
      r.operation_id ?? r.operations?.id ?? '',
      r.operations?.operation_number ?? '',
      r.operations?.machine ?? '',
      r.operations?.operation ?? '',
      r.operations?.name ?? '',
    ].join('|')
    return `${opKey}|${failureMode}|${effect}|${sev}|${cause}|${occ}|${currentPrev}|${currentDet}|${det}`
  }

  let i = 0
  while (i < tableRows.length) {
    const row = tableRows[i]
    if (isPlaceholderRowId(row.id)) {
      spans[i] = { span: 1, end: i }
      i += 1
      continue
    }

    const key = keyOf(i)
    if (!key) {
      spans[i] = { span: 1, end: i }
      i += 1
      continue
    }

    let j = i + 1
    while (j < tableRows.length) {
      const next = tableRows[j]
      if (isPlaceholderRowId(next.id)) break
      if (keyOf(j) !== key) break
      j += 1
    }
    for (let k = i; k < j; k += 1) spans[k] = { span: k === i ? j - i : 0, end: j - 1 }
    i = j
  }

  return spans
}

const op = {
  id: 'op-1',
  operation_number: 10,
  machine: 'EPOWER_01',
  operation: 'MONTAZ Driver',
  name: 'Pobranie obudowy',
}

const rows = [
  {
    id: 'row-main',
    operation_id: 'op-1',
    failure_mode: 'Pobranie niewlasciwej obudowy',
    effect: 'Zly kolor',
    severity: 7,
    characteristic: 'Obudowa biala',
    class: 'SC',
    cause: 'Brudny bin',
    occurrence: 10,
    current_prevention: 'Procedura',
    current_detection: 'Brak',
    detection: 10,
    operations: op,
  },
  {
    id: 'row-recommended-old',
    operation_id: 'op-1',
    failure_mode: 'Pobranie niewlasciwej obudowy',
    effect: '',
    severity: null,
    characteristic: 'Obudowa biala',
    class: 'SC',
    cause: '',
    occurrence: null,
    current_prevention: '',
    current_detection: '',
    detection: null,
    recommended_action: 'Stworzyc kontrole',
    operations: op,
  },
]

const failureBlock = buildFailureBlockMergeInfo(rows)
const actionPlanBlock = buildActionPlanBlockMergeInfo(rows)

if (failureBlock[0].span !== 2 || failureBlock[1].span !== 0) {
  throw new Error(`failureBlock merge regression: ${JSON.stringify(failureBlock)}`)
}

if (actionPlanBlock[0].span !== 2 || actionPlanBlock[1].span !== 0) {
  throw new Error(`actionPlanBlock merge regression: ${JSON.stringify(actionPlanBlock)}`)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      failureBlock,
      actionPlanBlock,
    },
    null,
    2
  )
)
