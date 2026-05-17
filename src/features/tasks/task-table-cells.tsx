'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'

import {
  settingsPopupItemStyle,
  settingsPopupPanelStyle,
  settingsProcessAccent,
} from '@/components/rf-ui'
import {
  TASK_STATUS_OPTIONS,
  anchoredPopupStyle,
  formatDate,
  formatIsoDate,
  getCalendarCells,
  parseIsoDateParts,
  taskCalendarAccent,
  taskCalendarBorder,
  taskCalendarMonths,
  taskCalendarMuted,
  taskCalendarWeekdays,
  taskInlineInputStyle,
  toDateInputValue,
  todayIsoDate,
} from './task-page-model'

export function TaskResponsibleCell({
  disabled,
  onSave,
  value,
}: {
  disabled?: boolean
  onSave: (value: string) => void
  value: string
}) {
  const [draft, setDraft] = useState(value === '-' ? '' : value)

  const commit = () => {
    const next = draft.trim() || '-'
    if (next !== value) onSave(next)
  }

  return (
    <input
      aria-label="Responsible"
      disabled={disabled}
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setDraft(value === '-' ? '' : value)
          event.currentTarget.blur()
        }
      }}
      placeholder="-"
      style={{
        ...taskInlineInputStyle,
        cursor: disabled ? 'not-allowed' : 'text',
        opacity: disabled ? 0.62 : 1,
      }}
    />
  )
}

export function TaskTargetDateCell({
  disabled,
  onSave,
  overdue,
  value,
}: {
  disabled?: boolean
  onSave: (value: string | null) => void
  overdue: boolean
  value: string | null
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [popupStyle, setPopupStyle] = useState<CSSProperties | null>(null)
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseIsoDateParts(toDateInputValue(value))
    if (parsed) return { year: parsed.year, month: parsed.month }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  useEffect(() => {
    if (!open) return

    const updatePopupPosition = () => {
      setPopupStyle(anchoredPopupStyle(triggerRef.current, 252, 8, 320))
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePopupPosition)
    window.addEventListener('scroll', updatePopupPosition, true)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePopupPosition)
      window.removeEventListener('scroll', updatePopupPosition, true)
    }
  }, [open])

  const selectedIso = toDateInputValue(value)
  const todayIso = todayIsoDate()
  const calendarCells = getCalendarCells(viewMonth.year, viewMonth.month)

  const changeMonth = (delta: number) => {
    setViewMonth((current) => {
      const nextDate = new Date(current.year, current.month + delta, 1)
      return { year: nextDate.getFullYear(), month: nextDate.getMonth() }
    })
  }

  const pickDate = (day: number) => {
    const nextValue = formatIsoDate(viewMonth.year, viewMonth.month, day)
    setOpen(false)
    onSave(nextValue)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Target date"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          const nextOpen = !open
          if (nextOpen) {
            const parsed = parseIsoDateParts(toDateInputValue(value))
            if (parsed) {
              setViewMonth({ year: parsed.year, month: parsed.month })
            } else {
              const now = new Date()
              setViewMonth({ year: now.getFullYear(), month: now.getMonth() })
            }
            setPopupStyle(anchoredPopupStyle(triggerRef.current, 252, 8, 320))
          }
          setOpen(nextOpen)
        }}
        style={{
          ...taskInlineInputStyle,
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          fontWeight: overdue ? 700 : 400,
          justifyContent: 'center',
          opacity: disabled ? 0.62 : 1,
        }}
      >
        <span style={{ color: overdue ? '#fca5a5' : '#f8fafc' }}>{formatDate(value)}</span>
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popupRef}
              role="dialog"
              aria-label="Target date calendar"
              style={{
                ...(popupStyle ?? anchoredPopupStyle(null, 252, 8, 320)),
                zIndex: 120,
                borderRadius: 10,
                border: `1px solid ${taskCalendarBorder}`,
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
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => changeMonth(-1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  â€ą
                </button>
                <div style={{ fontSize: 13, color: taskCalendarAccent, fontWeight: 700 }}>
                  {taskCalendarMonths[viewMonth.month]} {viewMonth.year}
                </div>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => changeMonth(1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  â€ş
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {taskCalendarWeekdays.map((label) => (
                  <div key={label} style={{ textAlign: 'center', fontSize: 11, color: taskCalendarMuted, fontWeight: 700, paddingBottom: 2 }}>
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
                      onMouseDown={(event) => event.preventDefault()}
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
                        color: taskCalendarAccent,
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
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    onSave(null)
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    onSave(todayIsoDate())
                  }}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: `1px solid ${taskCalendarBorder}`,
                    background: 'rgba(255,255,255,0.08)',
                    color: taskCalendarAccent,
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
    </>
  )
}

export function TaskStatusCell({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({
        left: Math.max(12, rect.left + rect.width / 2 - 70),
        top: rect.bottom + 8,
        width: 140,
      })
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    updatePosition()
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          color: settingsProcessAccent,
          cursor: disabled ? 'not-allowed' : 'pointer',
          font: 'inherit',
          fontSize: 12,
          fontWeight: 400,
          lineHeight: 1.25,
          margin: 0,
          opacity: disabled ? 0.62 : 1,
          padding: 0,
          textAlign: 'center',
        }}
      >
        {value || '-'}
      </button>

      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{
                ...settingsPopupPanelStyle,
                left: position.left,
                padding: 6,
                position: 'fixed',
                top: position.top,
                width: position.width,
                zIndex: 120,
              }}
            >
              {TASK_STATUS_OPTIONS.map((option) => {
                const selected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitem"
                    className="settings-popup-button"
                    onClick={() => {
                      setOpen(false)
                      onChange(option.value)
                    }}
                    style={{
                      ...settingsPopupItemStyle(selected),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
