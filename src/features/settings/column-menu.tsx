'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import {
  settingsPopupItemStyle,
  settingsPopupPanelStyle,
  settingsPopupText,
} from './invitation-shell'

export type SettingsColumnMenuItem = {
  key: string
  label: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  separatorBefore?: boolean
}

export const settingsTableColumnHeaderStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 6,
  width: 'auto',
}

export const settingsColumnMenuTriggerStyle: CSSProperties = {
  minHeight: 18,
  minWidth: 18,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: '#f8fafc',
}

export const settingsColumnMenuPanelStyle: CSSProperties = {
  ...settingsPopupPanelStyle,
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  minWidth: 224,
  padding: 8,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  zIndex: 20,
}

export const settingsColumnMenuItemStyle: CSSProperties = {
  ...settingsPopupItemStyle(false),
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontWeight: 600,
}

export const settingsColumnMenuDividerStyle: CSSProperties = {
  height: 1,
  margin: '6px 2px',
  background: 'rgba(255,255,255,0.08)',
}

const menuViewportMargin = 12
const menuEstimatedHeight = 176

function getMenuPosition(rect: DOMRect) {
  const left = Math.max(menuViewportMargin, rect.right - 224)
  const belowTop = rect.bottom + 8
  const aboveTop = rect.top - menuEstimatedHeight - 8
  const spaceBelow = window.innerHeight - belowTop - menuViewportMargin
  const spaceAbove = rect.top - menuViewportMargin

  return {
    top: spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow ? Math.max(menuViewportMargin, aboveTop) : belowTop,
    left,
  }
}

export function SettingsColumnMenu({
  title = 'Column actions',
  items,
}: {
  title?: string
  items: SettingsColumnMenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open || !rootRef.current) return

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition(getMenuPosition(rect))
    }

    updatePosition()

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
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
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rf-button"
        style={settingsColumnMenuTriggerStyle}
        onClick={() => setOpen((current) => !current)}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && menuPosition
        ? createPortal(
            <div
              role="menu"
              aria-label={title}
              style={{
                ...settingsColumnMenuPanelStyle,
                position: 'fixed',
                top: menuPosition.top,
                left: menuPosition.left,
                maxHeight: `calc(100vh - ${menuViewportMargin * 2}px)`,
                overflowY: 'auto',
              }}
            >
              {items.map((item) => (
                <div key={item.key}>
                  {item.separatorBefore ? <div style={settingsColumnMenuDividerStyle} /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    className="settings-popup-button"
                    style={settingsColumnMenuItemStyle}
                    onClick={() => {
                      item.onSelect?.()
                      setOpen(false)
                    }}
                  >
                    <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: settingsPopupText }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

export function SettingsTableColumnHeader({
  label,
  menuTitle,
  menuItems,
}: {
  label: ReactNode
  menuTitle?: string
  menuItems?: SettingsColumnMenuItem[]
}) {
  return (
    <div style={settingsTableColumnHeaderStyle}>
      <span>{label}</span>
      {menuItems?.length ? <SettingsColumnMenu title={menuTitle ?? 'Column actions'} items={menuItems} /> : null}
    </div>
  )
}
