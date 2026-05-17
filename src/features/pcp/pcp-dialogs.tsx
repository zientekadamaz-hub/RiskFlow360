import React from 'react'

import {
  SURFACE_BG,
  SURFACE_BORDER,
  SURFACE_MUTED,
  SURFACE_PANEL_BG,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  formatDateTimePL,
} from './pcp-page-model'
import type { PcpHistoryEntry } from './pcp-service'
import { nextPcpRevisionLabel } from './pcp-utils'

type PcpSaveDialogProps = {
  actionButtonStyle: React.CSSProperties
  currentAuthorName: string
  onClose: () => void
  onSaveClick: () => void
  rowCount: number
  saveBusy: boolean
  saveDescription: string
  setSaveDescription: (value: string) => void
  workingRevisionLabel: string | null | undefined
}

type PcpHistoryDialogProps = {
  actionButtonStyle: React.CSSProperties
  entries: PcpHistoryEntry[]
  loading: boolean
  onClose: () => void
}

const thHistory: React.CSSProperties = {
  textAlign: 'center',
  padding: '8px 10px',
  fontSize: 14,
  color: SURFACE_MUTED,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.08)',
}

const tdHistory: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 14,
  color: SURFACE_MUTED,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

export function PcpSaveDialog({
  actionButtonStyle,
  currentAuthorName,
  onClose,
  onSaveClick,
  rowCount,
  saveBusy,
  saveDescription,
  setSaveDescription,
  workingRevisionLabel,
}: PcpSaveDialogProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => !saveBusy && onClose()}>
      <div style={{ width: 560, maxWidth: '92vw', background: SURFACE_PANEL_BG, borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, boxShadow: '0 16px 36px rgba(0,0,0,0.2)', padding: 20, color: SURFACE_TEXT }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Save PCP</div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 12 }}>Describe what you changed.</div>
        <textarea value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} rows={5} style={{ width: '100%', borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 14, background: SURFACE_BG, color: SURFACE_TEXT }} />
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>Next revision: <b>{nextPcpRevisionLabel(workingRevisionLabel)}</b></div>
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>Author: <b>{currentAuthorName}</b></div>
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 14 }}>Current PCP: <b>{rowCount}</b> controls</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="rf-button" style={{ ...actionButtonStyle, padding: '8px 12px', height: 29 }} onClick={onClose} disabled={saveBusy}>Cancel</button>
          <button className="rf-button" style={{ ...actionButtonStyle, padding: '8px 12px', height: 29 }} onClick={onSaveClick} disabled={saveBusy || !saveDescription.trim()}>{saveBusy ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export function PcpHistoryDialog({
  actionButtonStyle,
  entries,
  loading,
  onClose,
}: PcpHistoryDialogProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1450, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: 920, maxWidth: '96vw', maxHeight: '80vh', overflow: 'auto', background: SURFACE_PANEL_BG, borderRadius: SURFACE_RADIUS, border: `1px solid ${SURFACE_BORDER}`, boxShadow: '0 16px 36px rgba(0,0,0,0.2)', padding: 20, color: SURFACE_TEXT }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 19 }}>PCP revision history</span>
          <button className="rf-button" style={{ ...actionButtonStyle, padding: '8px 12px', height: 29 }} onClick={onClose}>Close</button>
        </div>
        {loading ? (
          <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>Loading history...</div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>No saved history yet.</div>
        ) : (
          <div style={{ maxHeight: 260, overflowX: 'auto', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: SURFACE_RADIUS }}>
              <thead>
                <tr>
                  <th style={thHistory}>Revision</th>
                  <th style={thHistory}>Date</th>
                  <th style={thHistory}>Author</th>
                  <th style={thHistory}>Description</th>
                  <th style={thHistory}>Controls</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((h) => (
                  <tr key={h.id}>
                    <td style={{ ...tdHistory, textAlign: 'center', fontSize: 15, color: SURFACE_TEXT, fontWeight: 700 }}>{h.revisionLabel}</td>
                    <td style={tdHistory}>{formatDateTimePL(h.at)}</td>
                    <td style={tdHistory}>{h.author || '-'}</td>
                    <td style={{ ...tdHistory, fontSize: 15, color: SURFACE_TEXT }}>{h.description || '-'}</td>
                    <td style={{ ...tdHistory, textAlign: 'center' }}>{h.controlCount == null ? '-' : String(h.controlCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
