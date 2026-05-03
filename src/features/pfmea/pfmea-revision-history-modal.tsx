import { type RiskColor as RiskMatrixColor } from '../../../app/settings/risk-matrix/_lib/matrixColors'
import type { PfmeaHistoryEntry } from './pfmea-service'
import { pfmeaRevisionNumberFromLabel } from './pfmea-revision-utils'

type RiskColor = RiskMatrixColor

const SURFACE_RADIUS = 8
const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
const SURFACE_TEXT = '#f8fafc'
const SURFACE_MUTED = 'rgba(255,255,255,0.72)'

function colorFill(color: RiskColor) {
  if (color === 'red') return 'rgba(239,68,68,0.12)'
  if (color === 'orange') return 'rgba(251,146,60,0.18)'
  if (color === 'yellow') return 'rgba(250,204,21,0.22)'
  return 'rgba(34,197,94,0.18)'
}

type PfmeaRevisionHistoryModalProps = {
  entries: PfmeaHistoryEntry[]
  getAverageRpnColor: (value: number | null) => RiskColor | null
  loading: boolean
  onClose: () => void
}

export function PfmeaRevisionHistoryModal({
  entries,
  getAverageRpnColor,
  loading,
  onClose,
}: PfmeaRevisionHistoryModalProps) {
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
      onClick={onClose}
    >
      <div
        style={{
          width: 1215,
          maxWidth: '98vw',
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
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>PFMEA revision history</div>
        {loading ? (
          <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>Loading history...</div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: 14, color: SURFACE_MUTED, padding: '10px 0' }}>No saved history yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 260 }}>
            <table style={{ width: '100%', minWidth: 1080, tableLayout: 'fixed', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: SURFACE_RADIUS }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, width: 70, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgb(52, 57, 69)' }}>
                    Revision
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, width: 120, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgb(52, 57, 69)' }}>
                    Date
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, width: 120, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgb(52, 57, 69)' }}>
                    Author
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, width: 200, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgb(52, 57, 69)' }}>
                    Description
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, width: 70, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgb(52, 57, 69)' }}>
                    Risks
                  </th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, width: 70, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgb(52, 57, 69)' }}>
                    Average RPN
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const avgRpnColor = getAverageRpnColor(entry.avgRpn)
                  return (
                    <tr key={entry.id}>
                      <td style={{ width: 70, textAlign: 'center', padding: '8px 10px', fontSize: 15, color: SURFACE_TEXT, borderBottom: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>
                        {pfmeaRevisionNumberFromLabel(entry.revisionLabel)}
                      </td>
                      <td style={{ width: 120, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                        {new Date(entry.at).toLocaleString()}
                      </td>
                      <td style={{ width: 120, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                        {entry.author}
                      </td>
                      <td style={{ width: 200, textAlign: 'center', padding: '8px 10px', fontSize: 15, color: SURFACE_TEXT, borderBottom: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.description}
                      </td>
                      <td style={{ width: 70, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: SURFACE_MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                        {entry.riskCount == null ? '-' : Math.round(entry.riskCount)}
                      </td>
                      <td
                        style={{
                          width: 70,
                          textAlign: 'center',
                          padding: '8px 10px',
                          fontSize: 14,
                          color: '#f8fafc',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          background: avgRpnColor ? colorFill(avgRpnColor) : 'transparent',
                        }}
                      >
                        {entry.avgRpn == null ? '-' : Math.round(entry.avgRpn)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
