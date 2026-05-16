import React from 'react'

import type { PfmeaColumnId } from './pfmea-columns'
import { TdRead } from './pfmea-merged-cell'

type PfmeaOperationCellsProps = {
  isColumnVisible: (id: PfmeaColumnId) => boolean
  onExpandOperation: (operationId: string | null) => void
  operationId: string | null
  operationName: string
  opNo: number | null
  span: number
  station: string
  step: string
}

export function PfmeaOperationCells({
  isColumnVisible,
  onExpandOperation,
  operationId,
  operationName,
  opNo,
  span,
  station,
  step,
}: PfmeaOperationCellsProps) {
  if (span <= 0) return null

  const expandOperation = () => onExpandOperation(operationId)

  return (
    <>
      {isColumnVisible('id') ? (
        <TdRead
          value={opNo == null ? '' : String(opNo)}
          className="pfmeaTd gray center multiLine"
          rowSpan={span}
          onClick={expandOperation}
        />
      ) : null}
      {isColumnVisible('station') ? (
        <TdRead
          value={station}
          className="pfmeaTd gray center multiLine"
          rowSpan={span}
          onClick={expandOperation}
        />
      ) : null}
      {isColumnVisible('operation') ? (
        <TdRead
          value={operationName}
          className="pfmeaTd gray center multiLine"
          rowSpan={span}
          onClick={expandOperation}
        />
      ) : null}
      {isColumnVisible('process_step') ? (
        <TdRead
          value={step}
          className="pfmeaTd gray multiLine"
          rowSpan={span}
          onClick={expandOperation}
        />
      ) : null}
    </>
  )
}
