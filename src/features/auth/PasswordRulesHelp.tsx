'use client'

import React, { useState } from 'react'
import {
  settingsPopoverPanelStyle,
  settingsPopoverTitleStyle,
  settingsProcessAccent,
} from '@/components/rf-ui'

export function PasswordRulesHelp({ rules }: { rules: string[] }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={wrapperStyle}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Show password rules"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={iconButtonStyle}
      >
        !
      </button>

      {open ? (
        <div role="tooltip" style={popupStyle}>
          <div style={settingsPopoverTitleStyle}>Password rules</div>
          <ul style={rulesListStyle}>
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  )
}

const wrapperStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
}

const iconButtonStyle: React.CSSProperties = {
  width: 15,
  height: 15,
  minWidth: 15,
  borderRadius: 999,
  border: `1px solid rgba(217,168,108,0.72)`,
  background: 'rgba(217,168,108,0.12)',
  color: settingsProcessAccent,
  fontSize: 10,
  fontWeight: 900,
  lineHeight: '13px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
}

const popupStyle: React.CSSProperties = {
  ...settingsPopoverPanelStyle,
  position: 'absolute',
  left: -8,
  top: 24,
  zIndex: 120,
  width: 280,
  maxWidth: 'calc(96vw - 64px)',
  padding: 12,
}

const rulesListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 16,
  fontSize: 12,
  color: 'rgba(255,255,255,0.76)',
  lineHeight: 1.6,
}
