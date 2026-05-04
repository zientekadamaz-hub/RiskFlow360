import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { editorBase } from './pfmea-cell-styles'
import {
  CALENDAR_MONTHS,
  CALENDAR_WEEKDAYS,
  formatIsoDate,
  getCalendarCells,
  parseIsoDateParts,
  todayIsoDate,
} from './pfmea-date-utils'
import { anchoredPopupStyle } from './pfmea-popup-position'

const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_MUTED = 'rgba(255,255,255,0.72)'

type PfmeaEditorElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
type PfmeaEditorRef = React.MutableRefObject<PfmeaEditorElement | null>

function getDateViewMonth(value: string | null | undefined) {
  const parsed = parseIsoDateParts(value)
  if (parsed) return { year: parsed.year, month: parsed.month }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

export function TdDate(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onLiveChange?: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => void
  editorRef: PfmeaEditorRef
  stopEdit: () => void
  disabled?: boolean
  flash?: boolean
  cellKey?: string
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const cellRef = useRef<HTMLTableCellElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const { editorRef } = props
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [viewMonth, setViewMonth] = useState(() => getDateViewMonth(props.value))
  const val = props.value ?? ''

  useEffect(() => {
    if (!props.editing) return
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing])

  useEffect(() => {
    if (!props.editing) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (cellRef.current?.contains(target) || popupRef.current?.contains(target)) return
      props.stopEdit()
      props.onLiveChange?.(val ? val : null)
      props.onCommit(val ? val : null)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [props, val])

  const setCellRefs = useCallback((el: HTMLTableCellElement | null) => {
    cellRef.current = el
    setCellAnchorEl((current) => (current === el ? current : el))
  }, [])

  const setTriggerRefs = useCallback(
    (el: HTMLButtonElement | null) => {
      triggerRef.current = el
      editorRef.current = el
    },
    [editorRef]
  )

  const startEditing = useCallback(() => {
    setViewMonth(getDateViewMonth(props.value))
    props.onStart()
  }, [props])

  if (props.disabled) {
    return <td data-pfmea-col={props.cellKey} className={`pfmeaTd singleLine ${props.flash ? 'flashMissing' : ''}`}>{val || ''}</td>
  }

  if (!props.editing) {
    return (
      <td data-pfmea-col={props.cellKey} className={`pfmeaTd editable singleLine ${props.flash ? 'flashMissing' : ''}`} onClick={startEditing}>
        {val || ''}
      </td>
    )
  }

  const selectedParts = parseIsoDateParts(val)
  const selectedIso = selectedParts ? formatIsoDate(selectedParts.year, selectedParts.month, selectedParts.day) : ''
  const todayIso = todayIsoDate()
  const calendarCells = getCalendarCells(viewMonth.year, viewMonth.month)

  const changeMonth = (delta: number) => {
    setViewMonth((current) => {
      const nextDate = new Date(current.year, current.month + delta, 1)
      return { year: nextDate.getFullYear(), month: nextDate.getMonth() }
    })
  }

  const pickDate = (day: number) => {
    const nextVal = formatIsoDate(viewMonth.year, viewMonth.month, day)
    props.stopEdit()
    props.onLiveChange?.(nextVal)
    props.onCommit(nextVal)
  }

  return (
    <td data-pfmea-col={props.cellKey} ref={setCellRefs} className={`pfmeaTd editable singleLine ${props.flash ? 'flashMissing' : ''}`}>
      <button
        type="button"
        className="pfmeaEditor"
        ref={setTriggerRefs}
        onKeyDown={props.onKeyDown}
        style={{
          ...editorBase,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'rgba(255,255,255,0.08)',
          color: '#d9a86c',
          border: `1px solid ${SURFACE_BORDER}`,
          borderRadius: 8,
          height: 38,
          padding: '0 10px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span>{val || 'Select date'}</span>
        <span style={{ color: '#d9a86c', fontSize: 14, lineHeight: 1 }}>▾</span>
      </button>

      {cellAnchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              ref={popupRef}
              style={{
                ...anchoredPopupStyle(cellAnchorEl, 252, 0, 320),
                zIndex: 120,
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
                padding: 10,
                display: 'grid',
                gap: 10,
                position: 'fixed',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => changeMonth(-1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ‹
                </button>
                <div style={{ fontSize: 13, color: '#d9a86c', fontWeight: 700 }}>
                  {CALENDAR_MONTHS[viewMonth.month]} {viewMonth.year}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => changeMonth(1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ›
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {CALENDAR_WEEKDAYS.map((label) => (
                  <div key={label} style={{ textAlign: 'center', fontSize: 11, color: SURFACE_MUTED, fontWeight: 700, paddingBottom: 2 }}>
                    {label}
                  </div>
                ))}
                {calendarCells.map((cell) =>
                  cell.day == null ? (
                    <div key={cell.key} style={{ height: 30 }} />
                  ) : (
                    <button
                      key={cell.key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickDate(cell.day!)}
                      style={{
                        height: 30,
                        borderRadius: 8,
                        border: `1px solid ${
                          formatIsoDate(viewMonth.year, viewMonth.month, cell.day) === selectedIso
                            ? 'rgba(96, 165, 250, 0.55)'
                            : 'transparent'
                        }`,
                        background:
                          formatIsoDate(viewMonth.year, viewMonth.month, cell.day) === selectedIso
                            ? 'rgba(96, 165, 250, 0.18)'
                            : formatIsoDate(viewMonth.year, viewMonth.month, cell.day) === todayIso
                              ? 'rgba(255,255,255,0.08)'
                              : 'transparent',
                        color: '#d9a86c',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {cell.day}
                    </button>
                  )
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    props.stopEdit()
                    props.onLiveChange?.(null)
                    props.onCommit(null)
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const nextVal = todayIsoDate()
                    props.stopEdit()
                    props.onLiveChange?.(nextVal)
                    props.onCommit(nextVal)
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${SURFACE_BORDER}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#d9a86c',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Today
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </td>
  )
}
