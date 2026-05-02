'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { settingsColumnMenuButtonStyle, settingsPopupPanelStyle, settingsProcessAccent } from './invitation-shell'

type SortDirection = 'asc' | 'desc'
type PopupPosition = { top: number; left: number }

const columnMenuPanelWidth = 298
const columnMenuViewportMargin = 12
const filterPanelEstimatedHeight = 412
const actionPanelEstimatedHeight = 126

function SortAscIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SortDescIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 14l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const triggerStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#f8fafc',
  padding: 0,
  minWidth: 18,
  minHeight: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

const panelStyle: CSSProperties = {
  ...settingsPopupPanelStyle,
  position: 'fixed',
  width: columnMenuPanelWidth,
  padding: 10,
  zIndex: 40,
}

const popupButtonStyle: CSSProperties = settingsColumnMenuButtonStyle

const headerTriggerWrapStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  maxWidth: '100%',
  minWidth: 0,
}

const headerTriggerLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function getColumnMenuPosition(rect: DOMRect): PopupPosition {
  const maxLeft =
    typeof window === 'undefined'
      ? rect.left - 18
      : window.innerWidth - columnMenuPanelWidth - columnMenuViewportMargin

  return {
    top: rect.bottom + 8,
    left: Math.min(Math.max(columnMenuViewportMargin, rect.left - 18), Math.max(columnMenuViewportMargin, maxLeft)),
  }
}

function getViewportAwareColumnMenuPosition(rect: DOMRect, estimatedHeight: number): PopupPosition {
  if (typeof window === 'undefined') return getColumnMenuPosition(rect)

  const left = getColumnMenuPosition(rect).left
  const belowTop = rect.bottom + 8
  const aboveTop = rect.top - estimatedHeight - 8
  const spaceBelow = window.innerHeight - belowTop - columnMenuViewportMargin
  const spaceAbove = rect.top - columnMenuViewportMargin
  const shouldOpenAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow

  return {
    top: shouldOpenAbove ? Math.max(columnMenuViewportMargin, aboveTop) : belowTop,
    left,
  }
}

type SettingsFilterColumnHeaderProps = {
  label: string
  values: string[]
  selectedValues: string[]
  onApplyValues: (values: string[]) => void
  onSort: (direction: SortDirection) => void
  onHideColumn?: () => void
  accentColor?: string
}

type SettingsActionColumnHeaderProps = {
  label: string
  onSort: (direction: SortDirection) => void
  onHideColumn?: () => void
}

export function SettingsFilterColumnHeader({
  label,
  values,
  selectedValues,
  onApplyValues,
  onSort,
  onHideColumn,
  accentColor = settingsProcessAccent,
}: SettingsFilterColumnHeaderProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    values.reduce<Record<string, boolean>>((acc, value) => {
      acc[value] = selectedValues.includes(value)
      return acc
    }, {})
  )
  const [position, setPosition] = useState<PopupPosition | null>(null)

  const visibleOptions = values.filter((item) => item.toLowerCase().includes(search.trim().toLowerCase()))

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition(getViewportAwareColumnMenuPosition(rect, filterPanelEstimatedHeight))
    }

    updatePosition()

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

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

  const draftSelectedValues = Object.entries(checked)
    .filter(([, value]) => value)
    .map(([key]) => key)

  return (
    <>
      <div style={headerTriggerWrapStyle}>
        <span style={headerTriggerLabelStyle}>{label}</span>
        <button
          ref={triggerRef}
          type="button"
          title={`${label} filter`}
          aria-label={`${label} filter`}
          className="rf-button"
          style={triggerStyle}
          onClick={() => {
            setChecked(
              values.reduce<Record<string, boolean>>((acc, value) => {
                acc[value] = selectedValues.includes(value)
                return acc
              }, {})
            )
            setSearch('')
            setOpen((current) => !current)
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                ...panelStyle,
                top: position.top,
                left: position.left,
                maxHeight: `calc(100vh - ${columnMenuViewportMargin * 2}px)`,
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  type="button"
                  className="settings-popup-button"
                  style={popupButtonStyle}
                  onClick={() => {
                    onSort('asc')
                    setOpen(false)
                  }}
                >
                  <span style={{ display: 'inline-flex', marginRight: 8 }}><SortAscIcon /></span>
                  Sort ascending
                </button>
                <button
                  type="button"
                  className="settings-popup-button"
                  style={popupButtonStyle}
                  onClick={() => {
                    onSort('desc')
                    setOpen(false)
                  }}
                >
                  <span style={{ display: 'inline-flex', marginRight: 8 }}><SortDescIcon /></span>
                  Sort descending
                </button>
              </div>
              {onHideColumn ? <div style={{ height: 1, margin: '10px 0', background: 'rgba(255,255,255,0.08)' }} /> : null}
              {onHideColumn ? (
                <button
                  type="button"
                  className="settings-popup-button"
                  style={popupButtonStyle}
                  onClick={() => {
                    onHideColumn()
                    setOpen(false)
                  }}
                >
                  Hide column
                </button>
              ) : null}
              <div style={{ height: 1, margin: '10px 0', background: 'rgba(255,255,255,0.08)' }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                style={{
                  width: '100%',
                  height: 30,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.18)',
                  padding: '0 8px',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#d9a86c',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <div style={{ marginTop: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#d9a86c', marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor }}
                    checked={draftSelectedValues.length === values.length}
                    onChange={(event) =>
                      setChecked(
                        values.reduce<Record<string, boolean>>((acc, value) => {
                          acc[value] = event.target.checked
                          return acc
                        }, {})
                      )
                    }
                  />
                  <span>(Select all)</span>
                </label>
                {visibleOptions.map((option) => (
                  <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#d9a86c', marginBottom: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      style={{ accentColor }}
                      checked={checked[option]}
                      onChange={(event) => setChecked((current) => ({ ...current, [option]: event.target.checked }))}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="settings-popup-button"
                  style={{ ...popupButtonStyle, width: 'auto' }}
                  onClick={() => {
                    setChecked(
                      values.reduce<Record<string, boolean>>((acc, value) => {
                        acc[value] = selectedValues.includes(value)
                        return acc
                      }, {})
                    )
                    setOpen(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="settings-popup-button"
                  style={{ ...popupButtonStyle, width: 'auto' }}
                  onClick={() => {
                    onApplyValues(draftSelectedValues)
                    setOpen(false)
                  }}
                >
                  OK
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

export function SettingsActionColumnHeader({
  label,
  onSort,
  onHideColumn,
}: SettingsActionColumnHeaderProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopupPosition | null>(null)

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition(getViewportAwareColumnMenuPosition(rect, actionPanelEstimatedHeight))
    }

    updatePosition()

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

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
      <div style={headerTriggerWrapStyle}>
        <span style={headerTriggerLabelStyle}>{label}</span>
        <button
          ref={triggerRef}
          type="button"
          title={`${label} actions`}
          aria-label={`${label} actions`}
          className="rf-button"
          style={triggerStyle}
          onClick={() => setOpen((current) => !current)}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                ...panelStyle,
                top: position.top,
                left: position.left,
                maxHeight: `calc(100vh - ${columnMenuViewportMargin * 2}px)`,
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  type="button"
                  className="settings-popup-button"
                  style={popupButtonStyle}
                  onClick={() => {
                    onSort('asc')
                    setOpen(false)
                  }}
                >
                  <span style={{ display: 'inline-flex', marginRight: 8 }}><SortAscIcon /></span>
                  Sort ascending
                </button>
                <button
                  type="button"
                  className="settings-popup-button"
                  style={popupButtonStyle}
                  onClick={() => {
                    onSort('desc')
                    setOpen(false)
                  }}
                >
                  <span style={{ display: 'inline-flex', marginRight: 8 }}><SortDescIcon /></span>
                  Sort descending
                </button>
              </div>
              {onHideColumn ? <div style={{ height: 1, margin: '10px 0', background: 'rgba(255,255,255,0.08)' }} /> : null}
              {onHideColumn ? (
                <button
                  type="button"
                  className="settings-popup-button"
                  style={popupButtonStyle}
                  onClick={() => {
                    onHideColumn()
                    setOpen(false)
                  }}
                >
                  Hide column
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

type SettingsHiddenColumnHeaderProps = {
  label: string
  onShow: () => void
}

export function SettingsHiddenColumnHeader({ label, onShow }: SettingsHiddenColumnHeaderProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopupPosition | null>(null)

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition(getColumnMenuPosition(rect))
    }

    updatePosition()

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

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
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          ref={triggerRef}
          type="button"
          title={`${label} column actions`}
          aria-label={`${label} column actions`}
          className="rf-button"
          style={{ ...triggerStyle, color: settingsProcessAccent }}
          onClick={() => setOpen((current) => !current)}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                ...panelStyle,
                top: position.top,
                left: position.left,
              }}
            >
              <button
                type="button"
                className="settings-popup-button"
                style={popupButtonStyle}
                onClick={() => {
                  onShow()
                  setOpen(false)
                }}
              >
                Show column
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
