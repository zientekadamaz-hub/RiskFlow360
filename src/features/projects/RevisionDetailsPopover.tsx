'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  settingsPopoverBodyStyle,
  settingsPopoverPanelStyle,
  settingsPopoverTitleStyle,
  settingsSurfaceRadius,
} from '@/components/rf-ui'
import type { RevisionPopupData } from './types'
import { ProjectsRevisionHintIcon } from './icons'

type PopoverPosition = {
  left: number
  placement: 'above' | 'below'
  top: number
}

const revisionPopoverViewportMargin = 12
const revisionPopoverEstimatedHeight = 256

function getRevisionPopoverPosition(rect: DOMRect): PopoverPosition {
  const panelWidth = typeof window === 'undefined' ? 840 : Math.min(window.innerWidth * 0.94, 840)
  const maxLeft = typeof window === 'undefined' ? rect.right - panelWidth : window.innerWidth - panelWidth - revisionPopoverViewportMargin
  const left = Math.min(Math.max(revisionPopoverViewportMargin, rect.right - panelWidth), Math.max(revisionPopoverViewportMargin, maxLeft))
  const belowTop = rect.bottom + 8
  const aboveTop = rect.top - revisionPopoverEstimatedHeight - 8
  const spaceBelow = typeof window === 'undefined' ? revisionPopoverEstimatedHeight : window.innerHeight - belowTop - revisionPopoverViewportMargin
  const spaceAbove = rect.top - revisionPopoverViewportMargin
  const placement = spaceBelow < revisionPopoverEstimatedHeight && spaceAbove > spaceBelow ? 'above' : 'below'

  return {
    left,
    placement,
    top: placement === 'above' ? Math.max(revisionPopoverViewportMargin, aboveTop) : belowTop,
  }
}

export function RevisionDetailsPopover({
  projectId,
  revisionLabel,
  popup,
}: {
  projectId: string
  revisionLabel: string
  popup: RevisionPopupData
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const hasData = popup.rows.some((row) => row.hasData)
  const tableWrapperStyle = useMemo<React.CSSProperties>(
    () => ({
      marginTop: 4,
      overflow: 'hidden',
      borderRadius: settingsSurfaceRadius,
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.04)',
    }),
    []
  )

  useEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition(getRevisionPopoverPosition(rect))
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const show = () => setOpen(true)
  const hide = () => setOpen(false)

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={`Revision ${revisionLabel} details`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: '#f8fafc',
          fontWeight: open ? 800 : 650,
          cursor: 'help',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{revisionLabel}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <ProjectsRevisionHintIcon active={hasData || popup.loading} />
        </span>
      </span>

      {open && position
        ? createPortal(
            <div
              style={{
                ...settingsPopoverPanelStyle,
                position: 'fixed',
                top: position.top,
                left: position.left,
                zIndex: 70,
                width: 840,
                maxWidth: 'min(94vw, 840px)',
                maxHeight: `calc(100vh - ${revisionPopoverViewportMargin * 2}px)`,
                overflowY: 'auto',
                pointerEvents: 'none',
                transform: position.placement === 'above' ? 'translateY(-4px)' : 'translateY(0)',
              }}
            >
              <div style={settingsPopoverTitleStyle}>Revision details</div>
              <div style={tableWrapperStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'transparent' }}>
                  <thead>
                    <tr>
                      {[
                        { label: 'Module', width: 84 },
                        { label: 'Revision', width: 72 },
                        { label: 'Date', width: 150 },
                        { label: 'Author', width: 130 },
                        { label: 'Description', width: undefined },
                      ].map((column) => (
                        <th
                          key={column.label}
                          style={{
                            width: column.width,
                            textAlign: 'left',
                            padding: '8px 10px',
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.72)',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgb(40, 39, 47)',
                          }}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {popup.loading ? (
                      <tr>
                        <td colSpan={5} style={{ ...settingsPopoverBodyStyle, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                          Loading revision details...
                        </td>
                      </tr>
                    ) : popup.error ? (
                      <tr>
                        <td colSpan={5} style={{ ...settingsPopoverBodyStyle, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                          Revision details unavailable.
                        </td>
                      </tr>
                    ) : (
                      popup.rows.map((row) => (
                        <tr key={`${projectId}-${row.module}`}>
                          <td style={{ ...settingsPopoverBodyStyle, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.module}</td>
                          <td style={{ ...settingsPopoverBodyStyle, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700 }}>{row.revisionLabel}</td>
                          <td style={{ ...settingsPopoverBodyStyle, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.at}</td>
                          <td style={{ ...settingsPopoverBodyStyle, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{row.author}</td>
                          <td
                            style={{
                              ...settingsPopoverBodyStyle,
                              padding: '8px 10px',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              minWidth: 330,
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {row.description}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
