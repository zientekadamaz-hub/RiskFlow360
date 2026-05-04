import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { anchoredPopupStyle } from './pfmea-popup-position'

const SURFACE_BORDER = 'rgba(255,255,255,0.16)'

export function TdSelect(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onLiveChange?: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  stopEdit: () => void
  options: string[]
  disabled?: boolean
  flash?: boolean
  cellKey?: string
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [popupAnchorEl, setPopupAnchorEl] = useState<HTMLButtonElement | null>(null)
  const popupWidth = useMemo(() => {
    const longest = Math.max(
      props.value?.length ?? 0,
      ...props.options.map((opt) => opt.length)
    )
    return Math.min(220, Math.max(120, longest * 8 + 28))
  }, [props.options, props.value])
  useEffect(() => {
    if (!props.editing) return
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing])

  if (props.disabled) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        className={`pfmeaTd center singleLine scaleValue ${props.flash ? 'flashMissing' : ''}`}
        style={{ color: '#d9a86c' }}
      >
        {props.value ?? ''}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        className={`pfmeaTd editable center singleLine scaleValue scaleSelectCell ${props.flash ? 'flashMissing' : ''}`}
        style={{ color: '#d9a86c' }}
        onClick={props.onStart}
      >
        {props.value ?? ''}
      </td>
    )
  }

  return (
    <td
      data-pfmea-col={props.cellKey}
      ref={setCellAnchorEl}
      className={`pfmeaTd editable center singleLine scaleValue scaleSelectCell ${props.flash ? 'flashMissing' : ''}`}
      style={{ color: '#d9a86c' }}
    >
      <button
        type="button"
        ref={(node) => {
          triggerRef.current = node
          setPopupAnchorEl((current) => (current === node ? current : node))
        }}
        onKeyDown={props.onKeyDown}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          font: 'inherit',
          color: '#d9a86c',
          padding: 0,
          margin: 0,
          textAlign: 'center',
          cursor: 'pointer',
          fontWeight: 400,
          fontSize: 16,
        }}
      >
        {props.value ?? '-'}
      </button>

      {popupAnchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              onMouseLeave={props.stopEdit}
              style={{
                ...anchoredPopupStyle(popupAnchorEl, popupWidth, 0, 280, cellAnchorEl ?? popupAnchorEl),
                zIndex: 120,
                overflowY: 'auto',
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'fixed',
              }}
            >
              {props.options.map((opt) => {
                const isSelected = opt === props.value
                const optionLabel = opt === '' ? '(clear)' : opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      props.onLiveChange?.(opt || null)
                      props.stopEdit()
                      props.onCommit(opt)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid transparent',
                      borderRadius: 8,
                      background: isSelected ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: '#d9a86c',
                      padding: '7px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {optionLabel}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </td>
  )
}
