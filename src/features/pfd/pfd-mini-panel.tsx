import React, { type MutableRefObject } from 'react'
import Link from 'next/link'

import { clampPfmeaMiniScore, computePfmeaMiniDerived } from './pfmea-mini-service'
import type { PfmeaMiniRow } from './types'
import { ExcelNumberCell, ExcelTextCell } from './pfd-mini-table-cells'
import {
  PFMEA_ACCENT,
  PFMEA_CELL_TEXT,
  SURFACE_BORDER,
  SURFACE_MUTED,
  SURFACE_PANEL_BG,
  SURFACE_TEXT,
  baseBtn,
  td,
  th,
} from './pfd-page-styles'

type ColKey = 'failure_mode' | 'effect' | 'cause' | 'severity' | 'occurrence' | 'detection'

export function PfdMiniPfmeaPanel(props: {
  addMiniRow: () => void | Promise<void>
  colIndex: (col: ColKey) => number
  edit: { rowId: string; col: ColKey } | null
  editRef: MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>
  handleCellKeyDown: (
    event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
    allowEnterNewline: boolean
  ) => void
  onClose: () => void
  panelHeight: string
  pfmeaOpen: boolean
  pfmeaOpenOperationId: string | null
  projectId: string
  rows: PfmeaMiniRow[]
  selectedOperationLabel: string
  startEdit: (rowId: string, col: ColKey) => void
  stopEdit: () => void
  updateMiniCell: (row: PfmeaMiniRow, patch: Partial<PfmeaMiniRow>) => void | Promise<void>
}) {
  return (
    <div
      style={{
        width: '100%',
        height: props.panelHeight,
        transition: 'height 180ms ease',
        overflow: 'hidden',
        background: props.pfmeaOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
        borderTop: props.pfmeaOpen ? `1px solid ${SURFACE_BORDER}` : 'none',
        boxShadow: props.pfmeaOpen ? '0 -10px 30px rgba(0,0,0,0.22)' : 'none',
        backdropFilter: props.pfmeaOpen ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: props.pfmeaOpen ? 'blur(12px)' : undefined,
      }}
    >
      {props.pfmeaOpen && (
        <div style={{ height: '100%', padding: 14, display: 'flex', flexDirection: 'column', color: SURFACE_TEXT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: SURFACE_MUTED, fontWeight: 700 }}>PFMEA</div>
              <h3 style={{ margin: 0, fontSize: 16, color: SURFACE_TEXT }}>{props.selectedOperationLabel}</h3>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btnGreen" style={baseBtn} onClick={props.addMiniRow}>
                + Add row
              </button>
              <Link href={`/pfmea?project=${props.projectId}&op=${props.pfmeaOpenOperationId}`} className="btn btnGreen" style={baseBtn}>
                Open full PFMEA &rarr;
              </Link>
              <button className="btn btnGreen" style={baseBtn} onClick={props.onClose}>
                Close
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, flex: 1, overflow: 'auto', border: `1px solid ${SURFACE_BORDER}`, borderRadius: 12, background: SURFACE_PANEL_BG }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', background: SURFACE_PANEL_BG }}>
              <thead>
                <tr>
                  <th style={th({ width: 260 })}>Failure mode</th>
                  <th style={th({ width: 260 })}>Effect</th>
                  <th style={th({ width: 260 })}>Cause</th>
                  <th style={th({ width: 56, textAlign: 'center' })}>S</th>
                  <th style={th({ width: 56, textAlign: 'center' })}>O</th>
                  <th style={th({ width: 56, textAlign: 'center' })}>D</th>
                  <th style={th({ width: 72, textAlign: 'center' })}>RPN</th>
                </tr>
              </thead>

              <tbody>
                {props.rows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td style={td()}>
                      <ExcelTextCell
                        value={row.failure_mode}
                        editing={props.edit?.rowId === row.id && props.edit?.col === 'failure_mode'}
                        onStart={() => props.startEdit(row.id, 'failure_mode')}
                        onChange={(v) => props.updateMiniCell(row, { failure_mode: v })}
                        onKeyDown={(e) => props.handleCellKeyDown(e, rowIndex, props.colIndex('failure_mode'), true)}
                        onBlur={props.stopEdit}
                        editorRef={props.editRef}
                      />
                    </td>

                    <td style={td()}>
                      <ExcelTextCell
                        value={row.effect}
                        editing={props.edit?.rowId === row.id && props.edit?.col === 'effect'}
                        onStart={() => props.startEdit(row.id, 'effect')}
                        onChange={(v) => props.updateMiniCell(row, { effect: v })}
                        onKeyDown={(e) => props.handleCellKeyDown(e, rowIndex, props.colIndex('effect'), true)}
                        onBlur={props.stopEdit}
                        editorRef={props.editRef}
                      />
                    </td>

                    <td style={td()}>
                      <ExcelTextCell
                        value={row.cause}
                        editing={props.edit?.rowId === row.id && props.edit?.col === 'cause'}
                        onStart={() => props.startEdit(row.id, 'cause')}
                        onChange={(v) => props.updateMiniCell(row, { cause: v })}
                        onKeyDown={(e) => props.handleCellKeyDown(e, rowIndex, props.colIndex('cause'), true)}
                        onBlur={props.stopEdit}
                        editorRef={props.editRef}
                      />
                    </td>

                    <td style={td({ textAlign: 'center' })}>
                      <ExcelNumberCell
                        value={row.severity ?? 1}
                        editing={props.edit?.rowId === row.id && props.edit?.col === 'severity'}
                        onStart={() => props.startEdit(row.id, 'severity')}
                        onChange={(v) => props.updateMiniCell(row, { severity: clampPfmeaMiniScore(v) })}
                        onKeyDown={(e) => props.handleCellKeyDown(e, rowIndex, props.colIndex('severity'), false)}
                        onBlur={props.stopEdit}
                        editorRef={props.editRef}
                      />
                    </td>

                    <td style={td({ textAlign: 'center' })}>
                      <ExcelNumberCell
                        value={row.occurrence ?? 1}
                        editing={props.edit?.rowId === row.id && props.edit?.col === 'occurrence'}
                        onStart={() => props.startEdit(row.id, 'occurrence')}
                        onChange={(v) => props.updateMiniCell(row, { occurrence: clampPfmeaMiniScore(v) })}
                        onKeyDown={(e) => props.handleCellKeyDown(e, rowIndex, props.colIndex('occurrence'), false)}
                        onBlur={props.stopEdit}
                        editorRef={props.editRef}
                      />
                    </td>

                    <td style={td({ textAlign: 'center' })}>
                      <ExcelNumberCell
                        value={row.detection ?? 1}
                        editing={props.edit?.rowId === row.id && props.edit?.col === 'detection'}
                        onStart={() => props.startEdit(row.id, 'detection')}
                        onChange={(v) => props.updateMiniCell(row, { detection: clampPfmeaMiniScore(v) })}
                        onKeyDown={(e) => props.handleCellKeyDown(e, rowIndex, props.colIndex('detection'), false)}
                        onBlur={props.stopEdit}
                        editorRef={props.editRef}
                      />
                    </td>

                    <td
                      style={td({
                        textAlign: 'center',
                        fontWeight: 900,
                        background: 'rgba(255,255,255,0.08)',
                        color: PFMEA_ACCENT,
                        fontSize: 15,
                      })}
                    >
                      {row.rpn ?? computePfmeaMiniDerived(row).rpn ?? ''}
                    </td>
                  </tr>
                ))}

                {props.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, color: PFMEA_CELL_TEXT }}>
                      No PFMEA rows yet. Click <b>+ Add row</b>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
