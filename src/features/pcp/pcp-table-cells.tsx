import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  settingsHiddenTableColumnWidthPx,
  settingsTableCellStyle,
  settingsTableHeaderStyle,
} from '@/components/rf-ui'
import { normalizeClassValue } from './pcp-utils'
import {
  CLASS_OPTION_DETAILS,
  PCP_CLASS_OPTIONS,
  SURFACE_BORDER,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  anchoredPopupStyle,
} from './pcp-page-model'

export const pcpTableCellStyle: React.CSSProperties = {
  ...settingsTableCellStyle,
  color: '#e1e5ec',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.28,
  minHeight: 46,
  overflowWrap: 'anywhere',
  position: 'relative',
  textAlign: 'center',
  verticalAlign: 'middle',
  whiteSpace: 'normal',
}

const pcpSingleLineCellStyle: React.CSSProperties = {
  ...pcpTableCellStyle,
  height: 45,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export const pcpTableHeaderStyle: React.CSSProperties = {
  ...settingsTableHeaderStyle,
  boxSizing: 'border-box',
  overflow: 'hidden',
  padding: '8px 7px',
  position: 'sticky',
  textAlign: 'center',
  textOverflow: 'ellipsis',
  top: 0,
  zIndex: 5,
}

export const pcpHiddenTableCellStyle: React.CSSProperties = {
  ...pcpTableCellStyle,
  padding: '0 6px',
  width: settingsHiddenTableColumnWidthPx,
}

export const pcpHiddenTableHeaderStyle: React.CSSProperties = {
  ...pcpTableHeaderStyle,
  padding: '0 6px',
  width: settingsHiddenTableColumnWidthPx,
}

export function TdRead(props: { value: string; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={props.className ?? 'pcpTd singleLine'} style={{ ...pcpSingleLineCellStyle, ...props.style }}>
      {props.value ?? ''}
    </td>
  )
}

export function TdText(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string) => void
  onCancel: () => void
  disabled?: boolean
  singleLine?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const displayValue = props.value ?? ''
  const cellClassName = `pcpTd ${props.className ?? ''} ${props.singleLine ? 'singleLine' : ''}`.trim()
  const cellStyle: React.CSSProperties = props.singleLine
    ? {
        ...pcpSingleLineCellStyle,
        ...props.style,
        height: 45,
        paddingTop: 0,
        paddingBottom: 0,
        verticalAlign: 'middle',
      }
    : { ...pcpTableCellStyle, ...props.style }
  const singleLineEditorStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    height: 45,
    lineHeight: '45px',
    boxSizing: 'border-box',
  }

  if (props.disabled) {
    return (
      <td className={cellClassName} style={cellStyle}>
        {displayValue || ''}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td className={`${cellClassName} editable`.trim()} style={cellStyle} onClick={props.onStart}>
        {displayValue || ''}
      </td>
    )
  }

  return (
    <td className={`${cellClassName} editable`.trim()} style={cellStyle}>
      <PcpTextEditor
        key={`${props.singleLine ? 'single' : 'multi'}:${displayValue}`}
        initialValue={displayValue}
        onCancel={props.onCancel}
        onCommit={props.onCommit}
        singleLine={props.singleLine}
        singleLineEditorStyle={singleLineEditorStyle}
      />
    </td>
  )
}

function PcpTextEditor(props: {
  initialValue: string
  onCancel: () => void
  onCommit: (value: string) => void
  singleLine?: boolean
  singleLineEditorStyle: React.CSSProperties
}) {
  const [val, setVal] = useState(props.initialValue)
  const commitIfChanged = () => {
    props.onCancel()
    if (val !== props.initialValue) props.onCommit(val)
  }

  if (props.singleLine) {
    return (
      <input
        autoFocus
        className="pfmeaEditor"
        style={props.singleLineEditorStyle}
        value={val}
        onChange={(event) => setVal(event.target.value)}
        onBlur={commitIfChanged}
      />
    )
  }

  return (
    <textarea
      autoFocus
      className="pfmeaEditor"
      rows={1}
      value={val}
      onChange={(event) => setVal(event.target.value)}
      onBlur={commitIfChanged}
    />
  )
}

export function TdClassPopup(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string) => void
  onCancel: () => void
  disabled?: boolean
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const normalizedValue = normalizeClassValue(props.value)
  const details = normalizedValue ? CLASS_OPTION_DETAILS[normalizedValue] : null
  const setAnchorRef = useCallback((node: HTMLTableCellElement | null) => {
    setAnchorEl((current) => (current === node ? current : node))
  }, [])
  const detailsPopup =
    hoverOpen && anchorEl && details && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-pfmea-popup="true"
            style={{
              ...anchoredPopupStyle(anchorEl, 360),
              zIndex: 130,
              overflowY: 'auto',
              borderRadius: 10,
              border: `1px solid ${SURFACE_BORDER}`,
              background: 'rgb(52, 57, 69)',
              boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
              padding: 10,
              textAlign: 'left',
              position: 'fixed',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>{details.title}</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {details.description.map((line, idx) => (
                <div key={`${normalizedValue}-detail-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.35, fontWeight: 400 }}>
                  - {line}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      : null

  if (props.disabled) {
    return (
      <td
        ref={setAnchorRef}
        className="pcpTd center singleLine"
        style={{ ...pcpSingleLineCellStyle, color: '#d9a86c' }}
        onMouseEnter={() => (details ? setHoverOpen(true) : null)}
        onMouseLeave={() => setHoverOpen(false)}
      >
        {props.value ?? ''}
        {detailsPopup}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        ref={setAnchorRef}
        className="pcpTd editable center singleLine"
        style={{ ...pcpSingleLineCellStyle, color: '#d9a86c' }}
        onClick={props.onStart}
        onMouseEnter={() => (details ? setHoverOpen(true) : null)}
        onMouseLeave={() => setHoverOpen(false)}
      >
        {props.value ?? ''}
        {detailsPopup}
      </td>
    )
  }

  return (
    <TdSelectPopup
      value={props.value}
      editing={props.editing}
      onStart={props.onStart}
      onCommit={props.onCommit}
      onCancel={props.onCancel}
      options={PCP_CLASS_OPTIONS}
      disabled={props.disabled}
      className="gray"
      textColor="#d9a86c"
    />
  )
}

export function TdSelectPopup(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string) => void
  onCancel: () => void
  options: string[]
  disabled?: boolean
  className?: string
  textColor?: string
}) {
  const cellClassName = `pcpTd center singleLine ${props.className ?? ''}`.trim()
  const textColor = props.textColor ?? SURFACE_TEXT

  if (props.disabled) {
    return (
      <td className={cellClassName} style={{ ...pcpSingleLineCellStyle, color: textColor }}>
        {props.value ?? ''}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td className={`${cellClassName} editable`.trim()} style={{ ...pcpSingleLineCellStyle, color: textColor }} onClick={props.onStart}>
        {props.value ?? ''}
      </td>
    )
  }

  return (
    <td className={`${cellClassName} editable`.trim()} style={{ ...pcpSingleLineCellStyle, position: 'relative', color: textColor }}>
      <button type="button" style={{ width: '100%', border: 0, background: 'transparent', fontWeight: 700, color: textColor }}>
        {props.value ?? '-'}
      </button>
      <div
        onMouseLeave={props.onCancel}
        style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 120,
          width: 260,
          maxHeight: 240,
          overflowY: 'auto',
          borderRadius: SURFACE_RADIUS,
          border: `1px solid ${SURFACE_BORDER}`,
          background: 'rgb(52, 57, 69)',
          boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {props.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              props.onCancel()
              props.onCommit(opt)
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              border: '1px solid transparent',
              borderRadius: 8,
              background: opt === props.value ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: textColor,
              padding: '7px 8px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </td>
  )
}
