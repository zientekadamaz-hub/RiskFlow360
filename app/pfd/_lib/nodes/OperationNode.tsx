'use client'

import React, { useState } from 'react'
import type { NodeProps } from 'reactflow'
import { Dot } from '../ui/Dot'
import { BothHandlesAtPoint } from '../ui/handles'
import {
  HIT,
  OP_HEIGHT,
  OP_WIDTH,
  S,
  SHADOW,
  SHADOW_SELECTED,
  STROKE,
  UI_FONT,
} from '../ui/const'
import type { PfdData } from './types'

export default function OperationNode({ id, data, selected }: NodeProps<PfdData>) {
  const [hot, setHot] = useState<null | 'top' | 'right' | 'bottom' | 'left'>(null)

  const opNo = data.opNo ?? 0
  const w = OP_WIDTH
  const h = OP_HEIGHT

  const station = data.station ?? ''
  const operation = data.operation ?? ''
  const step = data.name ?? ''

  const missingStation = !station.trim()
  const missingOperation = !operation.trim()
  const missingStep = !step.trim()
  const hasErrors = missingStation || missingOperation || missingStep

  const outlineColor = hasErrors
    ? 'rgba(220,38,38,0.35)'
    : selected
      ? 'rgba(78,124,98,0.58)'
      : 'rgba(107,145,125,0.42)'

  const shadow = selected ? SHADOW_SELECTED : SHADOW

  const top = { x: w / 2, y: 0 }
  const right = { x: w, y: h / 2 }
  const bottom = { x: w / 2, y: h }
  const left = { x: 0, y: h / 2 }

  const cardBg = hasErrors ? 'rgba(255,242,242,0.96)' : 'rgba(232,243,237,0.96)'
  const headerBg = hasErrors ? 'rgba(253,226,226,0.92)' : 'rgba(223,236,228,0.92)'
  const chipBg = hasErrors ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.62)'
  const edgePad = 10 * S
  const topRowH = 20 * S
  const chipRadius = 7 * S
  const rowGap = 8 * S

  const chipInputStyle: React.CSSProperties = {
    height: topRowH,
    fontSize: 13 * S,
    fontFamily: UI_FONT,
    fontWeight: 700,
    color: '#5b667c',
    padding: `0 ${10 * S}px`,
    background: chipBg,
    border: 'none',
    outline: 'none',
    borderRadius: chipRadius,
    boxSizing: 'border-box',
    textAlign: 'center',
    cursor: 'text',
    userSelect: 'text',
  }

  const opNoBadgeStyle: React.CSSProperties = {
    height: topRowH,
    minWidth: 34 * S,
    padding: `0 ${8 * S}px`,
    borderRadius: chipRadius,
    background: hasErrors ? 'linear-gradient(180deg,#f97373 0%,#dc2626 100%)' : 'linear-gradient(180deg,#67c285 0%,#3f9b63 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16 * S,
    fontWeight: 600,
    lineHeight: 1,
    color: 'white',
    boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
    boxSizing: 'border-box',
  }

  const stepStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    fontFamily: UI_FONT,
    fontWeight: 600,
    color: '#424a5f',
    padding: 0,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    textAlign: 'center',
    cursor: 'text',
    userSelect: 'text',
  }

  const headerH = 42 * S
  const stepBoxW = Math.max(60, w - edgePad * 2)
  const stepBoxH = Math.max(60, h - (headerH + STROKE + 10 * S + edgePad))
  const stepLineHeight = 1.08
  const stepBaseFont = 23 * S
  const stepMinFont = 10 * S
  const stepMeasureText = step.trim() ? step : 'Process Step'
  const fitSingleLineFont = (value: string, boxWidth: number, base: number, min: number) => {
    const text = value.trim()
    if (!text) return base
    let size = base
    for (let i = 0; i < 12; i += 1) {
      const estimated = text.length * size * 0.56
      if (estimated <= Math.max(20, boxWidth - 14 * S) || size <= min) break
      size = Math.max(min, size - 0.5 * S)
    }
    return size
  }

  const stationW = 88 * S
  const operationW = 140 * S
  const stationFont = fitSingleLineFont(station || 'Station', stationW, 13 * S, 10 * S)
  const operationFont = fitSingleLineFont(operation || 'Operation', operationW, 13 * S, 10 * S)

  let stepFontSize = stepBaseFont
  let stepTextHeight = stepFontSize * stepLineHeight
  for (let i = 0; i < 20; i += 1) {
    const charsPerLine = Math.max(4, Math.floor(stepBoxW / (stepFontSize * 0.56)))
    const lines = stepMeasureText.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
    stepTextHeight = lines * stepFontSize * stepLineHeight
    if (stepTextHeight <= stepBoxH || stepFontSize <= stepMinFont) break
    stepFontSize = Math.max(stepMinFont, stepFontSize - 1)
  }
  const stepTopPad = Math.max(0, Math.floor((stepBoxH - stepTextHeight) / 2))

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const sx = rect.width / w
        const sy = rect.height / h
        const x = (e.clientX - rect.left) / (sx || 1)
        const y = (e.clientY - rect.top) / (sy || 1)
        const pts = { top, right, bottom, left } as const
        let best: typeof hot = null
        let bestDist = Infinity
        ;(Object.keys(pts) as Array<keyof typeof pts>).forEach((k) => {
          const p = pts[k]
          const d = Math.hypot(x - p.x, y - p.y)
          if (d < bestDist) {
            bestDist = d
            best = k
          }
        })
        setHot(bestDist <= HIT * 1.6 ? best : null)
      }}
      onMouseLeave={() => setHot(null)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        data.onOpenPfmea?.(id)
      }}
      style={{
        fontFamily: UI_FONT,
        width: w,
        height: h,
        padding: 0,
        borderRadius: 14 * S,
        background: cardBg,
        border: `${STROKE}px solid ${outlineColor}`,
        boxShadow: shadow,
        color: '#3f475a',
        userSelect: 'none',
        cursor: data.editable ? 'grab' : 'default',
        position: 'relative',
        boxSizing: 'border-box',
        ['--pfd-dot-color' as any]: outlineColor,
      }}
    >
      {BothHandlesAtPoint('top', top, 'y', 'top')}
      {BothHandlesAtPoint('right', right, 'x', 'right')}
      {BothHandlesAtPoint('bottom', bottom, 'y', 'bottom')}
      {BothHandlesAtPoint('left', left, 'x', 'left')}

      <Dot x={top.x} y={top.y} active={hot === 'top'} />
      <Dot x={right.x} y={right.y} active={hot === 'right'} />
      <Dot x={bottom.x} y={bottom.y} active={hot === 'bottom'} />
      <Dot x={left.x} y={left.y} active={hot === 'left'} />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            height: 42 * S,
            padding: `${edgePad}px`,
            display: 'flex',
            alignItems: 'center',
            gap: rowGap,
            background: headerBg,
            borderTopLeftRadius: 14 * S,
            borderTopRightRadius: 14 * S,
            pointerEvents: 'auto',
            boxSizing: 'border-box',
          }}
        >
          <div style={opNoBadgeStyle}>{opNo}</div>

          <input
            className="nodrag nopan"
            value={station}
            placeholder="Station"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => data.onPatch?.(id, { station: e.target.value })}
            style={{ ...chipInputStyle, width: stationW, fontSize: stationFont }}
          />

          <input
            className="nodrag nopan"
            value={operation}
            placeholder="Operation"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => data.onPatch?.(id, { operation: e.target.value })}
            style={{ ...chipInputStyle, width: operationW, fontSize: operationFont }}
          />
        </div>

        <div
          style={{
            height: STROKE,
            background: hasErrors ? 'rgba(220,38,38,0.20)' : 'rgba(107,145,125,0.20)',
          }}
        />

        <div style={{ position: 'relative', flex: 1, padding: `${10 * S}px ${edgePad}px ${edgePad}px`, boxSizing: 'border-box' }}>
          <textarea
            className="nodrag nopan pfd-step-textarea"
            value={step}
            placeholder="Process Step"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => data.onPatch?.(id, { name: e.target.value })}
            style={{
              ...stepStyle,
              fontSize: stepFontSize,
              lineHeight: stepLineHeight,
              paddingTop: stepTopPad,
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: edgePad,
              bottom: 2 * S,
              fontSize: 96 * S,
              lineHeight: 0.85,
              fontWeight: 700,
              color: hasErrors ? 'rgba(220,38,38,0.08)' : 'rgba(78,124,98,0.10)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {opNo}
          </div>
        </div>
      </div>
    </div>
  )
}
