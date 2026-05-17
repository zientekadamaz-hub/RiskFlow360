import React from 'react'

import { UI_FONT } from '../../../app/pfd/_lib/ui/const'
import { PFMEA_ACCENT, PFMEA_CELL_TEXT } from './pfd-page-styles'

function ExcelView({ value, onStart, align = 'left' }: { value: string; onStart: () => void; align?: 'left' | 'center' }) {
  return (
    <div
      onClick={onStart}
      style={{
        padding: '8px 10px',
        minHeight: 44,
        cursor: 'text',
        textAlign: align,
        fontWeight: 500,
        color: align === 'center' ? PFMEA_ACCENT : PFMEA_CELL_TEXT,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        lineHeight: 1.25,
      }}
    >
      {value ? value : <span style={{ color: '#aaa', fontWeight: 600 }}>—</span>}
    </div>
  )
}

export function ExcelTextCell({
  value,
  editing,
  onStart,
  onChange,
  onKeyDown,
  onBlur,
  editorRef,
}: {
  value: string
  editing: boolean
  onStart: () => void
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onBlur: () => void
  editorRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
}) {
  if (!editing) return <ExcelView value={value} onStart={onStart} />

  return (
    <textarea
      ref={editorRef as React.RefObject<HTMLTextAreaElement>}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        width: '100%',
        minHeight: 44,
        resize: 'vertical',
        border: 0,
        outline: 0,
        boxShadow: 'none',
        padding: '8px 10px',
        borderRadius: 0,
        fontFamily: UI_FONT,
        fontWeight: 500,
        color: PFMEA_CELL_TEXT,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        lineHeight: 1.25,
        background: 'transparent',
      }}
    />
  )
}

export function ExcelNumberCell({
  value,
  editing,
  onStart,
  onChange,
  onKeyDown,
  onBlur,
  editorRef,
}: {
  value: number
  editing: boolean
  onStart: () => void
  onChange: (v: number) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur: () => void
  editorRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
}) {
  if (!editing) return <ExcelView value={String(value)} onStart={onStart} align="center" />

  return (
    <input
      ref={editorRef as React.RefObject<HTMLInputElement>}
      type="number"
      min={1}
      max={10}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        width: '100%',
        border: 0,
        outline: 0,
        boxShadow: 'none',
        padding: '8px 10px',
        borderRadius: 0,
        fontFamily: UI_FONT,
        fontWeight: 700,
        textAlign: 'center',
        color: PFMEA_ACCENT,
        background: 'transparent',
        minHeight: 44,
      }}
    />
  )
}
