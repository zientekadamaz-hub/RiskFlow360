export type PfmeaMergeInfo = {
  span: number
  end: number
}

export type PfmeaOperationMergeRow = {
  operation_id?: string | null
  operations?: {
    id?: string | null
    operation_number?: number | null
    machine?: string | null
    operation?: string | null
    name?: string | null
  } | null
}

function operationMergeKey(row: PfmeaOperationMergeRow) {
  const opKey = row.operation_id ?? row.operations?.id ?? ''
  const opNo = row.operations?.operation_number ?? ''
  const station = row.operations?.machine ?? ''
  const operationName = row.operations?.operation ?? ''
  const step = row.operations?.name ?? ''
  return `${opKey}|${opNo}|${station}|${operationName}|${step}`
}

export function buildPfmeaOperationMergeInfo(rows: PfmeaOperationMergeRow[]): PfmeaMergeInfo[] {
  const spans = rows.map(() => ({ span: 0, end: 0 }))

  let i = 0
  while (i < rows.length) {
    const key = operationMergeKey(rows[i])
    let j = i + 1
    while (j < rows.length && operationMergeKey(rows[j]) === key) j += 1

    const runLen = j - i
    for (let k = i; k < j; k += 1) {
      spans[k] = { span: k === i ? runLen : 0, end: j - 1 }
    }
    i = j
  }

  return spans
}

export function resolvePfmeaBlockEndAnchorRow<T>(
  rows: T[],
  rowIndex: number,
  mergeInfo: PfmeaMergeInfo[]
) {
  const endIndex = mergeInfo[rowIndex]?.end ?? rowIndex
  return rows[endIndex] ?? rows[rowIndex] ?? null
}

export function findPfmeaMergeOwnerRow<T>(
  rows: T[],
  rowIndex: number,
  mergeInfo: PfmeaMergeInfo[]
) {
  for (let i = rowIndex; i >= 0; i -= 1) {
    const item = mergeInfo[i]
    if (item?.span && item.end >= rowIndex) return rows[i] ?? null
  }

  return rows[rowIndex] ?? null
}
