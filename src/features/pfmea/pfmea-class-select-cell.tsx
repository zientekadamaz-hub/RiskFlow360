import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MergedCellInner, mergedCellTdStyle } from './pfmea-merged-cell'
import { adjacentPopupStyle, anchoredPopupStyle } from './pfmea-popup-position'

const SURFACE_BORDER = 'rgba(255,255,255,0.16)'

type SelectOption = {
  value: string
  label: string
}

export const CLASS_OPTIONS: SelectOption[] = [
  { value: 'SC', label: 'SC - Special Characteristic' },
  { value: 'CC', label: 'CC - Critical Characteristic' },
]

const CLASS_OPTION_DETAILS: Record<string, { title: string; description: string[] }> = {
  SC: {
    title: 'SC - Special Characteristic',
    description: [
      'A product characteristic or process parameter that requires special control because deviation may affect function, quality, compliance, performance, assembly, or downstream processing.',
      'This characteristic should be clearly identified and included in process controls, for example in the PCP.',
    ],
  },
  CC: {
    title: 'CC - Critical Characteristic',
    description: [
      'A critical characteristic, which is a specific subset of SC, where deviation may cause the most severe consequences.',
      'Examples include safety risk, non-compliance with legal requirements, or loss of a critical function.',
    ],
  },
}

export function TdClassSelect(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  stopEdit: () => void
  options: SelectOption[]
  rowSpan?: number
  disabled?: boolean
  cellKey?: string
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [popupAnchorEl, setPopupAnchorEl] = useState<HTMLButtonElement | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hoveredOption, setHoveredOption] = useState<SelectOption | null>(null)
  const [optionHoverOpen, setOptionHoverOpen] = useState(false)
  useEffect(() => {
    if (!props.editing) return
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing])

  const clearHoverTimer = useCallback(() => {
    if (!hoverTimerRef.current) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const stopOptionHover = useCallback(() => {
    clearHoverTimer()
    setOptionHoverOpen(false)
    setHoveredOption(null)
  }, [clearHoverTimer])

  const startOptionHoverDelay = useCallback(
    (opt: SelectOption) => {
      clearHoverTimer()
      setHoveredOption(opt)
      hoverTimerRef.current = setTimeout(() => {
        setOptionHoverOpen(true)
      }, 700)
    },
    [clearHoverTimer]
  )

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])
  const hoveredOptionDetails = hoveredOption ? CLASS_OPTION_DETAILS[hoveredOption.value] : null
  const popupAnchorWidth = popupAnchorEl?.getBoundingClientRect().width ?? 300
  const setTriggerRefs = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node
    setPopupAnchorEl((current) => (current === node ? current : node))
  }, [])

  if (props.disabled) {
    return (
      <td data-pfmea-col={props.cellKey} rowSpan={props.rowSpan} className="pfmeaTd center singleLine scaleValue" style={mergedCellTdStyle(props.rowSpan)}>
        <MergedCellInner rowSpan={props.rowSpan} gap={0}>
          <span>{props.value ?? ''}</span>
        </MergedCellInner>
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        className="pfmeaTd editable center singleLine scaleValue scaleSelectCell"
        style={mergedCellTdStyle(props.rowSpan)}
        onClick={props.onStart}
      >
        <MergedCellInner rowSpan={props.rowSpan} gap={0}>
          <span>{props.value ?? ''}</span>
        </MergedCellInner>
      </td>
    )
  }

  return (
    <td data-pfmea-col={props.cellKey} rowSpan={props.rowSpan} ref={setCellAnchorEl} className="pfmeaTd editable center gray singleLine scaleValue scaleSelectCell">
      <button
        type="button"
        ref={setTriggerRefs}
        onKeyDown={props.onKeyDown}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          font: 'inherit',
          color: 'inherit',
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
              onMouseLeave={() => {
                stopOptionHover()
                props.stopEdit()
              }}
              style={{
                ...anchoredPopupStyle(popupAnchorEl, 300, 0, 280, cellAnchorEl ?? popupAnchorEl),
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
                const isSelected = opt.value === props.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => startOptionHoverDelay(opt)}
                    onMouseLeave={stopOptionHover}
                    onClick={() => {
                      stopOptionHover()
                      props.stopEdit()
                      props.onCommit(opt.value)
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
                    {opt.label}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}

      {optionHoverOpen && popupAnchorEl && hoveredOptionDetails && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              style={{
                ...adjacentPopupStyle(popupAnchorEl, 360, popupAnchorWidth, 8, 280),
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
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>
                {hoveredOptionDetails.title}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {hoveredOptionDetails.description.map((line, idx) => (
                  <div key={`${hoveredOption?.value ?? 'option'}-detail-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.35, fontWeight: 400 }}>
                    - {line}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </td>
  )
}
