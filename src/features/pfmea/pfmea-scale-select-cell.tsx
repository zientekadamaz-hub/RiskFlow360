import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MergedCellInner, mergedCellTdStyle } from './pfmea-merged-cell'
import { adjacentPopupStyle, anchoredPopupStyle } from './pfmea-popup-position'

const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const MUTED_SCALE_COLOR = '#8f96a3'

type SeverityOption = {
  level: number
  label: string
  examples: string[]
}

export function TdScaleSelect(props: {
  value: number | null
  editing: boolean
  onStart: () => void
  onCommit: (n: number | null) => void
  onLiveChange?: (n: number | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  stopEdit: () => void
  options: SeverityOption[]
  rowSpan?: number
  disabled?: boolean
  flash?: boolean
  cellKey?: string
  muted?: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const optionHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cellAnchorEl, setCellAnchorEl] = useState<HTMLTableCellElement | null>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const [optionHoverOpen, setOptionHoverOpen] = useState(false)
  const [hoveredOption, setHoveredOption] = useState<SeverityOption | null>(null)

  const selected = useMemo(() => props.options.find((x) => x.level === props.value) ?? null, [props.options, props.value])
  const hoverExamples = selected?.examples ?? []
  const hoveredOptionExamples = hoveredOption?.examples ?? []

  const clearHoverTimer = useCallback(() => {
    if (!hoverTimerRef.current) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const clearOptionHoverTimer = useCallback(() => {
    if (!optionHoverTimerRef.current) return
    clearTimeout(optionHoverTimerRef.current)
    optionHoverTimerRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearHoverTimer()
      clearOptionHoverTimer()
    }
  }, [clearHoverTimer, clearOptionHoverTimer])

  useEffect(() => {
    if (!props.editing) return
    clearHoverTimer()
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [props.editing, clearHoverTimer])

  const startHoverDelay = useCallback(() => {
    if (props.value == null || hoverExamples.length === 0) return
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => setHoverOpen(true), 700)
  }, [props.value, hoverExamples.length, clearHoverTimer])

  const stopHover = useCallback(() => {
    clearHoverTimer()
    setHoverOpen(false)
  }, [clearHoverTimer])

  const startOptionHoverDelay = useCallback(
    (opt: SeverityOption) => {
      if (opt.examples.length === 0) return
      clearOptionHoverTimer()
      setHoveredOption(opt)
      optionHoverTimerRef.current = setTimeout(() => setOptionHoverOpen(true), 700)
    },
    [clearOptionHoverTimer]
  )

  const stopOptionHover = useCallback(() => {
    clearOptionHoverTimer()
    setOptionHoverOpen(false)
    setHoveredOption(null)
  }, [clearOptionHoverTimer])

  const closeScaleMenu = useCallback(() => {
    stopOptionHover()
    props.stopEdit()
  }, [props, stopOptionHover])
  const mutedTextStyle = props.muted ? { color: MUTED_SCALE_COLOR } : undefined
  const mutedClassName = props.muted ? ' mutedScaleValue' : ''
  const selectedDetailsPopup =
    hoverOpen && cellAnchorEl && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-pfmea-popup="true"
            style={{
              ...anchoredPopupStyle(cellAnchorEl, 360, 0, 280),
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
              {selected ? `${selected.level} - ${selected.label}` : 'Examples'}
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {hoverExamples.map((ex, idx) => (
                <div key={`${selected?.level ?? 'x'}-ex-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.3, fontWeight: 400 }}>
                  - {ex}
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
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        ref={setCellAnchorEl}
        className={`pfmeaTd center gray singleLine scaleValue scaleSelectCell${mutedClassName} ${props.flash ? 'flashMissing' : ''}`}
        style={mergedCellTdStyle(props.rowSpan, mutedTextStyle)}
        onMouseEnter={startHoverDelay}
        onMouseLeave={stopHover}
      >
        <MergedCellInner rowSpan={props.rowSpan} gap={0}>
          <span style={mutedTextStyle}>{props.value == null ? '' : String(props.value)}</span>
        </MergedCellInner>
        {selectedDetailsPopup}
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        ref={setCellAnchorEl}
        className={`pfmeaTd editable center gray singleLine scaleValue scaleSelectCell${mutedClassName} ${props.flash ? 'flashMissing' : ''}`}
        style={mergedCellTdStyle(props.rowSpan, mutedTextStyle)}
        onClick={() => {
          stopHover()
          props.onStart()
        }}
        onMouseEnter={startHoverDelay}
        onMouseLeave={stopHover}
      >
        <MergedCellInner rowSpan={props.rowSpan} gap={0}>
          <span style={mutedTextStyle}>{props.value == null ? '' : String(props.value)}</span>
        </MergedCellInner>
        {selectedDetailsPopup}
      </td>
    )
  }

  return (
    <td
      data-pfmea-col={props.cellKey}
      rowSpan={props.rowSpan}
      ref={setCellAnchorEl}
      className={`pfmeaTd editable center singleLine scaleValue scaleSelectCell${mutedClassName} ${props.flash ? 'flashMissing' : ''}`}
      style={mutedTextStyle}
    >
      <button
        type="button"
        ref={triggerRef}
        onKeyDown={props.onKeyDown}
        style={{
          width: '100%',
          minHeight: 18,
          border: 0,
          outline: 'none',
          background: 'transparent',
          font: 'inherit',
          color: props.muted ? MUTED_SCALE_COLOR : 'inherit',
          padding: 0,
          margin: 0,
          textAlign: 'center',
          cursor: 'pointer',
          fontWeight: 400,
          fontSize: 16,
        }}
      >
        {props.value == null ? '-' : String(props.value)}
      </button>

      {cellAnchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              onMouseLeave={closeScaleMenu}
              style={{
                ...anchoredPopupStyle(cellAnchorEl, 300, 0, 280),
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
              {props.options.length === 0 ? (
                <div style={{ fontSize: 12, color: '#d9a86c', padding: 8, textAlign: 'left', fontWeight: 400 }}>No active values.</div>
              ) : (
                <>
                  {props.options.map((opt) => {
                    const isSelected = opt.level === props.value
                    return (
                      <button
                        key={opt.level}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => startOptionHoverDelay(opt)}
                        onMouseLeave={stopOptionHover}
                        onClick={() => {
                          stopOptionHover()
                          props.onLiveChange?.(opt.level)
                          props.stopEdit()
                          props.onCommit(opt.level)
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
                        {opt.level} - {opt.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={stopOptionHover}
                    onClick={() => {
                      stopOptionHover()
                      props.onLiveChange?.(null)
                      props.stopEdit()
                      props.onCommit(null)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid transparent',
                      borderRadius: 8,
                      background: props.value == null ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: '#d9a86c',
                      padding: '7px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1.25,
                      marginTop: 4,
                    }}
                  >
                    (clear)
                  </button>
                </>
              )}
            </div>,
            document.body
          )
        : null}

      {optionHoverOpen && cellAnchorEl && hoveredOption && hoveredOptionExamples.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              style={{
                ...adjacentPopupStyle(cellAnchorEl, 360, 300, 8, 280),
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
                {hoveredOption.level} - {hoveredOption.label}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {hoveredOptionExamples.map((ex, idx) => (
                  <div key={`${hoveredOption.level}-hover-ex-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.3, fontWeight: 400 }}>
                    - {ex}
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
