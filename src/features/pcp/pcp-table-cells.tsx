import React, { useCallback, useImperativeHandle, useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizeClassValue } from './pcp-utils'
import {
  CLASS_OPTION_DETAILS,
  PCP_CLASS_OPTIONS,
  SURFACE_BORDER,
  SURFACE_PANEL_BG,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  anchoredPopupStyle,
} from './pcp-page-model'

export function SummaryCard(props: {
  title: string
  value: number
  displayValue?: React.ReactNode
  bg: string
  bd: string
  fg: string
  style?: React.CSSProperties
  valueStyle?: React.CSSProperties
}) {
  return (
    <div style={{ ...props.style, border: `1px solid ${props.bd}`, background: props.bg }}>
      <div style={{ color: props.fg, fontSize: 12, marginBottom: 8 }}>{props.title}</div>
      <div style={{ color: props.fg, ...(props.valueStyle ?? { fontSize: 24, fontWeight: 800, lineHeight: 1 }) }}>
        {props.displayValue ?? props.value}
      </div>
    </div>
  )
}

export function Th(props: { w: string; children?: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'center',
        padding: '10px 8px',
        fontSize: 13,
        color: 'rgba(255,255,255,0.78)',
        width: props.w,
        maxWidth: props.w,
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        borderRight: '1px solid rgba(255,255,255,0.14)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: SURFACE_PANEL_BG,
        boxShadow: 'none',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        lineHeight: 1.15,
        fontWeight: 650,
      }}
    >
      {props.children}
    </th>
  )
}

export function TdRead(props: { value: string; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={props.className ?? 'pfmeaTd singleLine'} style={props.style}>
      {props.value ?? ''}
    </td>
  )
}

export function TdText(props: {
  value: string | null
  rowId: string
  col: string
  editing: boolean
  onStart: () => void
  onCommit: (v: string) => void | Promise<void>
  onCancel: () => void
  onDraftChange?: (rowId: string, col: string, value: string) => void
  onDraftClear?: (rowId: string, col: string) => void
  disabled?: boolean
  editorRef?: React.Ref<PcpEditorCommitTarget>
  singleLine?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const displayValue = props.value ?? ''
  const cellClassName = `pfmeaTd ${props.className ?? ''} ${props.singleLine ? 'singleLine' : ''}`.trim()
  const singleLineCellStyle: React.CSSProperties | undefined = props.singleLine
    ? {
        ...props.style,
        height: 45,
        paddingTop: 0,
        paddingBottom: 0,
        verticalAlign: 'middle',
      }
    : props.style
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
      <td className={cellClassName} style={singleLineCellStyle}>
        {displayValue || ''}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td className={`${cellClassName} editable`.trim()} style={singleLineCellStyle} onClick={props.onStart}>
        {displayValue || ''}
      </td>
    )
  }

  return (
    <td className={`${cellClassName} editable`.trim()} style={singleLineCellStyle}>
      <PcpTextEditor
        key={`${props.singleLine ? 'single' : 'multi'}:${displayValue}`}
        initialValue={displayValue}
        editorRef={props.editorRef}
        onCancel={props.onCancel}
        onCommit={props.onCommit}
        onDraftChange={(value) => props.onDraftChange?.(props.rowId, props.col, value)}
        onDraftClear={() => props.onDraftClear?.(props.rowId, props.col)}
        singleLine={props.singleLine}
        singleLineEditorStyle={singleLineEditorStyle}
      />
    </td>
  )
}

export type PcpEditorCommitTarget = {
  commit: () => void | Promise<void>
}

function PcpTextEditor(props: {
  editorRef?: React.Ref<PcpEditorCommitTarget>
  initialValue: string
  onCancel: () => void
  onCommit: (value: string) => void | Promise<void>
  onDraftChange: (value: string) => void
  onDraftClear: () => void
  singleLine?: boolean
  singleLineEditorStyle: React.CSSProperties
}) {
  const [val, setVal] = useState(props.initialValue)
  const commitIfChanged = useCallback(() => {
    props.onCancel()
    props.onDraftClear()
    if (val !== props.initialValue) return props.onCommit(val)
  }, [props, val])

  useImperativeHandle(props.editorRef, () => ({ commit: commitIfChanged }), [commitIfChanged])

  const handleChange = (value: string) => {
    setVal(value)
    props.onDraftChange(value)
  }

  if (props.singleLine) {
    return (
      <input
        autoFocus
        className="pfmeaEditor"
        style={props.singleLineEditorStyle}
        value={val}
        onChange={(event) => handleChange(event.target.value)}
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
      onChange={(event) => handleChange(event.target.value)}
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
        className="pfmeaTd center gray singleLine"
        style={{ color: '#d9a86c' }}
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
        className="pfmeaTd editable center gray singleLine"
        style={{ color: '#d9a86c' }}
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
  const cellClassName = `pfmeaTd center singleLine ${props.className ?? ''}`.trim()
  const textColor = props.textColor ?? SURFACE_TEXT

  if (props.disabled) {
    return (
      <td className={cellClassName} style={{ color: textColor }}>
        {props.value ?? ''}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td className={`${cellClassName} editable`.trim()} style={{ color: textColor }} onClick={props.onStart}>
        {props.value ?? ''}
      </td>
    )
  }

  return (
    <td className={`${cellClassName} editable`.trim()} style={{ position: 'relative', color: textColor }}>
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
