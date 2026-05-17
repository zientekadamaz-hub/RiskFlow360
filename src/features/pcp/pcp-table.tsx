import React from 'react'

import { asInt1to10 } from './pcp-utils'
import type { PcpColumnId } from './pcp-page-model'
import { SURFACE_RADIUS } from './pcp-page-model'
import type { PcpRow } from './pcp-service'
import { TdClassPopup, TdRead, TdText, Th } from './pcp-table-cells'

export type PcpEditCell = { rowId: string; col: keyof PcpRow } | null

type PcpTableProps = {
  cardStyle: React.CSSProperties
  edit: PcpEditCell
  isColumnVisible: (id: PcpColumnId) => boolean
  pcpYellowMax: number
  readOnly: boolean
  rows: PcpRow[]
  setEdit: React.Dispatch<React.SetStateAction<PcpEditCell>>
  updateRow: (row: PcpRow, patch: Partial<PcpRow>) => void | Promise<void>
  visibleColumnDefs: Array<{ id: PcpColumnId }>
  visibleTableWidth: number
  widthOf: (id: PcpColumnId) => string
}

const highlightedMetricStyle: React.CSSProperties = {
  color: '#d9a86c',
}

export function PcpTable({
  cardStyle,
  edit,
  isColumnVisible,
  pcpYellowMax,
  readOnly,
  rows,
  setEdit,
  updateRow,
  visibleColumnDefs,
  visibleTableWidth,
  widthOf,
}: PcpTableProps) {
  return (
    <div style={{ ...cardStyle, padding: 0, borderRadius: SURFACE_RADIUS, overflow: 'visible' }}>
      <div className="pfmeaTable" style={{ maxHeight: 'calc(100vh - 280px)', overflowX: 'auto', overflowY: 'visible' }}>
        <table style={{ width: `${visibleTableWidth}px`, minWidth: `${visibleTableWidth}px`, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 16, fontFamily: 'Calibri, Arial, sans-serif' }}>
          <colgroup>{visibleColumnDefs.map((c) => <col key={c.id} style={{ width: widthOf(c.id) }} />)}</colgroup>
          <thead>
            <tr>
              {isColumnVisible('id') ? <Th w={widthOf('id')}>ID#</Th> : null}
              {isColumnVisible('station') ? <Th w={widthOf('station')}>STATION</Th> : null}
              {isColumnVisible('operation') ? <Th w={widthOf('operation')}>OPERATION</Th> : null}
              {isColumnVisible('process_step') ? <Th w={widthOf('process_step')}>PROCESS STEP</Th> : null}
              {isColumnVisible('failure_mode') ? <Th w={widthOf('failure_mode')}>FAILURE MODE</Th> : null}
              {isColumnVisible('characteristic') ? <Th w={widthOf('characteristic')}>CHARACTERISTIC</Th> : null}
              {isColumnVisible('class') ? <Th w={widthOf('class')}>CLASS</Th> : null}
              {isColumnVisible('severity') ? <Th w={widthOf('severity')}>SEV</Th> : null}
              {isColumnVisible('rpn') ? <Th w={widthOf('rpn')}>RPN</Th> : null}
              {isColumnVisible('current_prevention') ? <Th w={widthOf('current_prevention')}>CURRENT CONTROLS (PREV)</Th> : null}
              {isColumnVisible('current_detection') ? <Th w={widthOf('current_detection')}>CURRENT CONTROLS (DET)</Th> : null}
              {isColumnVisible('control_method') ? <Th w={widthOf('control_method')}>CONTROL METHOD</Th> : null}
              {isColumnVisible('sample_size') ? <Th w={widthOf('sample_size')}>SAMPLE SIZE</Th> : null}
              {isColumnVisible('frequency') ? <Th w={widthOf('frequency')}>FREQUENCY</Th> : null}
              {isColumnVisible('reaction_plan') ? <Th w={widthOf('reaction_plan')}>REACTION PLAN</Th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const severityValue = asInt1to10(r.severity)
              const severityHighlighted = severityValue != null && severityValue >= 9
              const rpnValue = typeof r.rpn === 'number' && Number.isFinite(r.rpn) ? r.rpn : null
              const rpnHighlighted = rpnValue != null && rpnValue > pcpYellowMax

              return (
                <tr key={r.id} className="pfmeaRow">
                  {isColumnVisible('id') ? <TdRead value={String(r.operations?.operation_number ?? '-')} className="pfmeaTd center gray singleLine" /> : null}
                  {isColumnVisible('station') ? <TdRead value={r.operations?.machine ?? ''} className="pfmeaTd gray singleLine" /> : null}
                  {isColumnVisible('operation') ? <TdRead value={r.operations?.operation ?? ''} className="pfmeaTd gray singleLine" /> : null}
                  {isColumnVisible('process_step') ? <TdRead value={r.operations?.name ?? ''} className="pfmeaTd gray singleLine" /> : null}
                  {isColumnVisible('failure_mode') ? <TdText value={r.failure_mode} editing={edit?.rowId === r.id && edit?.col === 'failure_mode'} onStart={() => setEdit({ rowId: r.id, col: 'failure_mode' })} onCommit={(v) => void updateRow(r, { failure_mode: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('characteristic') ? <TdText value={r.characteristic} editing={edit?.rowId === r.id && edit?.col === 'characteristic'} onStart={() => setEdit({ rowId: r.id, col: 'characteristic' })} onCommit={(v) => void updateRow(r, { characteristic: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('class') ? <TdClassPopup value={r.class} editing={edit?.rowId === r.id && edit?.col === 'class'} onStart={() => setEdit({ rowId: r.id, col: 'class' })} onCommit={(v) => void updateRow(r, { class: v || null })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                  {isColumnVisible('severity') ? <TdRead value={r.severity == null ? '' : String(r.severity)} className="pfmeaTd center gray singleLine" style={severityHighlighted ? highlightedMetricStyle : undefined} /> : null}
                  {isColumnVisible('rpn') ? <TdRead value={r.rpn == null ? '' : String(r.rpn)} className="pfmeaTd center gray singleLine" style={rpnHighlighted ? highlightedMetricStyle : undefined} /> : null}
                  {isColumnVisible('current_prevention') ? <TdText value={r.current_prevention} editing={edit?.rowId === r.id && edit?.col === 'current_prevention'} onStart={() => setEdit({ rowId: r.id, col: 'current_prevention' })} onCommit={(v) => void updateRow(r, { current_prevention: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('current_detection') ? <TdText value={r.current_detection} editing={edit?.rowId === r.id && edit?.col === 'current_detection'} onStart={() => setEdit({ rowId: r.id, col: 'current_detection' })} onCommit={(v) => void updateRow(r, { current_detection: v })} onCancel={() => setEdit(null)} disabled={readOnly} className="gray" /> : null}
                  {isColumnVisible('control_method') ? <TdText value={r.control_method} editing={edit?.rowId === r.id && edit?.col === 'control_method'} onStart={() => setEdit({ rowId: r.id, col: 'control_method' })} onCommit={(v) => void updateRow(r, { control_method: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                  {isColumnVisible('sample_size') ? <TdText value={r.sample_size} editing={edit?.rowId === r.id && edit?.col === 'sample_size'} onStart={() => setEdit({ rowId: r.id, col: 'sample_size' })} onCommit={(v) => void updateRow(r, { sample_size: v })} onCancel={() => setEdit(null)} disabled={readOnly} singleLine /> : null}
                  {isColumnVisible('frequency') ? <TdText value={r.frequency} editing={edit?.rowId === r.id && edit?.col === 'frequency'} onStart={() => setEdit({ rowId: r.id, col: 'frequency' })} onCommit={(v) => void updateRow(r, { frequency: v })} onCancel={() => setEdit(null)} disabled={readOnly} singleLine /> : null}
                  {isColumnVisible('reaction_plan') ? <TdText value={r.reaction_plan} editing={edit?.rowId === r.id && edit?.col === 'reaction_plan'} onStart={() => setEdit({ rowId: r.id, col: 'reaction_plan' })} onCommit={(v) => void updateRow(r, { reaction_plan: v })} onCancel={() => setEdit(null)} disabled={readOnly} /> : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
