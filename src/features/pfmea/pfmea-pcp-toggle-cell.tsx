import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { anchoredPopupStyle } from './pfmea-popup-position'

const SURFACE_BORDER = 'rgba(255,255,255,0.16)'

export function TdPcpToggle(props: {
  checked: boolean
  reasons: string[]
  disabled?: boolean
  onToggle: () => void
  cellKey?: string
}) {
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const popupReasons = props.checked ? (props.reasons.length > 0 ? props.reasons : ['MANUAL']) : []
  const showPopup = hoverOpen && popupReasons.length > 0 && cellAnchorEl

  return (
    <td
      data-pfmea-col={props.cellKey}
      ref={setCellAnchorEl}
      className="pfmeaTd center singleLine"
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
    >
      <button
        type="button"
        onClick={props.onToggle}
        disabled={props.disabled}
        aria-label={props.checked ? 'Included in PCP' : 'Excluded from PCP'}
        aria-pressed={props.checked}
        title={popupReasons.join('\n') || undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `1px solid ${props.checked ? 'rgba(217,168,108,0.55)' : 'rgba(255,255,255,0.22)'}`,
          background: props.checked ? 'rgba(217,168,108,0.16)' : 'transparent',
          color: props.checked ? '#f6d7a7' : 'rgba(255,255,255,0.32)',
          fontSize: 14,
          fontWeight: 700,
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? 0.5 : 1,
        }}
      >
        {props.checked ? '✓' : ''}
      </button>

      {showPopup && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              style={{
                ...anchoredPopupStyle(cellAnchorEl, 220, 0, 240),
                zIndex: 120,
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
                padding: 10,
                textAlign: 'left',
                position: 'fixed',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>
                PCP selection
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {popupReasons.map((reason, idx) => (
                  <div key={`${reason}-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.35, fontWeight: 400 }}>
                    - {reason}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </td>
  )
}
