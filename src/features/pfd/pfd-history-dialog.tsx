import React from 'react'

import type { PfdHistoryEntry } from './types'
import {
  SURFACE_BORDER,
  SURFACE_MUTED,
  SURFACE_PANEL_BG,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  baseBtn,
} from './pfd-page-styles'

const headerCellStyle = {
  textAlign: 'center' as const,
  padding: '8px 10px',
  fontSize: 14,
  color: SURFACE_MUTED,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.08)',
}

const mutedCellStyle = {
  padding: '8px 10px',
  fontSize: 14,
  color: SURFACE_MUTED,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

export function PfdHistoryDialog(props: {
  entries: PfdHistoryEntry[]
  open: boolean
  onClose: () => void
}) {
  if (!props.open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: 864,
          maxWidth: '94vw',
          maxHeight: '80vh',
          overflow: 'auto',
          background: SURFACE_PANEL_BG,
          borderRadius: SURFACE_RADIUS,
          border: `1px solid ${SURFACE_BORDER}`,
          boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
          padding: 20,
          color: SURFACE_TEXT,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>PFD change history</div>
        {props.entries.length === 0 ? (
          <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>No saved history yet.</div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
              overflowY: 'auto',
              maxHeight: 260,
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: SURFACE_RADIUS,
              }}
            >
              <thead>
                <tr>
                  <th style={headerCellStyle}>Revision</th>
                  <th style={headerCellStyle}>Date</th>
                  <th style={headerCellStyle}>Author</th>
                  <th style={headerCellStyle}>Description</th>
                  <th style={headerCellStyle}>Objects</th>
                  <th style={headerCellStyle}>Connections</th>
                </tr>
              </thead>
              <tbody>
                {props.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td
                      style={{
                        textAlign: 'center',
                        padding: '8px 10px',
                        fontSize: 15,
                        color: SURFACE_TEXT,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontWeight: 700,
                      }}
                    >
                      {entry.revision}
                    </td>
                    <td style={mutedCellStyle}>{new Date(entry.at).toLocaleString()}</td>
                    <td style={mutedCellStyle}>{entry.author}</td>
                    <td
                      style={{
                        padding: '8px 10px',
                        fontSize: 15,
                        color: SURFACE_TEXT,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {entry.description}
                    </td>
                    <td style={{ ...mutedCellStyle, textAlign: 'center' }}>{entry.nodeCount}</td>
                    <td style={{ ...mutedCellStyle, textAlign: 'center' }}>{entry.edgeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={props.onClose} style={{ ...baseBtn, height: 28, padding: '0 12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
