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

export default function ProcessRefNode({ id, data, selected }: NodeProps<PfdData>) {
  const [hot, setHot] = useState<null | 'top' | 'right' | 'bottom' | 'left'>(null)
  const [hovered, setHovered] = useState(false)

  const w = OP_WIDTH
  const h = OP_HEIGHT
  const processName = data.name ?? ''
  const processOptions = data.processOptions ?? []
  const hasValue = !!processName.trim()
  const hasErrors = !hasValue

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
  const chipBg = hasErrors ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.62)'
  const chipRadius = 7 * S
  const edgePad = 12 * S
  const sideBarW = Math.max(24 * S, 30 * S)
  const accentBarBg = hasErrors ? 'rgba(253,226,226,0.92)' : 'rgba(223,236,228,0.92)'
  const stepLineHeight = 1.08
  const stepBaseFont = 23 * S
  const stepMinFont = 10 * S
  const displayText = processName.trim()
  const stepBoxW = Math.max(60, w - edgePad * 2)
  const stepBoxH = Math.max(60, h - edgePad * 2)

  let stepFontSize = stepBaseFont
  let stepTextHeight = stepFontSize * stepLineHeight
  for (let i = 0; i < 20; i += 1) {
    const charsPerLine = Math.max(4, Math.floor(stepBoxW / (stepFontSize * 0.56)))
    const lines = displayText.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHot(null)
        setHovered(false)
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

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: sideBarW,
          borderTopLeftRadius: 14 * S,
          borderBottomLeftRadius: 14 * S,
          background: accentBarBg,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: sideBarW,
          top: 0,
          bottom: 0,
          width: 1,
          background: hasErrors ? 'rgba(220,38,38,0.35)' : 'rgba(107,145,125,0.42)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: sideBarW,
          borderTopRightRadius: 14 * S,
          borderBottomRightRadius: 14 * S,
          background: accentBarBg,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: sideBarW,
          top: 0,
          bottom: 0,
          width: 1,
          background: hasErrors ? 'rgba(220,38,38,0.35)' : 'rgba(107,145,125,0.42)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: `${edgePad}px`,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: edgePad,
            right: edgePad,
            top: 12 * S,
            fontSize: 34 * S,
            lineHeight: 1,
            fontWeight: 700,
            color: hasErrors ? 'rgba(220,38,38,0.08)' : 'rgba(78,124,98,0.10)',
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          Sub - Process
        </div>
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: `${stepTopPad}px ${12 * S}px 0`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: 0,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              fontFamily: UI_FONT,
              fontWeight: 600,
              color: displayText ? '#424a5f' : '#8e97a8',
              fontSize: stepFontSize,
              lineHeight: stepLineHeight,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxWidth: 'calc(100% - 12px)',
            }}
          >
            {displayText || 'Sub - Process'}
          </div>
          {!displayText ? (
            <div
              style={{
                marginTop: Math.max(8 * S, stepFontSize * 0.34),
                marginLeft: Math.max(10 * S, stepFontSize * 0.55),
                fontSize: Math.max(15 * S, stepFontSize * 0.9),
                lineHeight: 1,
                color: '#8e97a8',
                fontWeight: 700,
                transform: 'scaleX(1.42)',
                transformOrigin: 'center',
              }}
            >
              ˅
            </div>
          ) : null}
        </div>
        {data.editable && hovered ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              maxWidth: 210 * S,
              height: 34 * S,
              border: hasErrors ? '1px solid rgba(220,38,38,0.24)' : '1px solid rgba(107,145,125,0.24)',
              borderRadius: chipRadius,
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          >
            <select
              className="nodrag nopan processRefSelect"
              value={processName}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => data.onPatch?.(id, { name: e.target.value })}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                pointerEvents: 'all',
              }}
            >
              <option value="">{''}</option>
              {processOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  )
}
