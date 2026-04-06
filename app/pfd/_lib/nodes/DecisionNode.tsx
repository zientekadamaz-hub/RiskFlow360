'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'
import type { NodeProps } from 'reactflow'
import { Dot } from '../ui/Dot'
import { roundedDiamondPath } from '../ui/geometry'
import { BothHandlesAtPoint } from '../ui/handles'
import { DEC_H, DEC_W, HIT, S, STROKE, UI_FONT } from '../ui/const'
import type { PfdData } from './types'

export default function DecisionNode({ id, data, selected }: NodeProps<PfdData>) {
  const [hot, setHot] = useState<null | 'top' | 'right' | 'bottom' | 'left'>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)

  const w = DEC_W
  const h = DEC_H

  const top = { x: w / 2, y: 0 }
  const right = { x: w, y: h / 2 }
  const bottom = { x: w / 2, y: h }
  const left = { x: 0, y: h / 2 }

  const fillColor = 'rgba(232,243,237,0.96)'
  const stroke = selected ? 'rgba(78,124,98,0.58)' : 'rgba(107,145,125,0.42)'
  const textColor = '#424a5f'
  const text = data.name ?? 'Decision'

  useLayoutEffect(() => {
    if (isEditing) return
    const el = labelRef.current
    if (!el) return
    if ((el.textContent ?? '') !== text) el.textContent = text
  }, [isEditing, text])

  const r = 10 * S
  const d = roundedDiamondPath(w, h, r)
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
      style={{
        width: w,
        height: h,
        position: 'relative',
        cursor: data.editable ? 'grab' : 'default',
        userSelect: 'none',
        fontFamily: UI_FONT,
        ['--pfd-dot-color' as any]: stroke,
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path
          d={d}
          fill={fillColor}
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            filter: selected
              ? 'drop-shadow(0px 10px 26px rgba(0,0,0,0.22))'
              : 'drop-shadow(0px 6px 18px rgba(0,0,0,0.12))',
          }}
        />
      </svg>

      {(() => {
        const boxW = Math.max(100 * S, w * 0.5)
        const boxH = Math.max(48 * S, h * 0.48)
        const base = 23 * S
        const min = 10 * S
        let fontSize = base
        const maxIters = 12
        for (let i = 0; i < maxIters; i += 1) {
          const charsPerLine = Math.max(4, Math.floor(boxW / (fontSize * 0.6)))
          const lines = Math.max(1, Math.ceil(text.length / charsPerLine))
          const neededH = lines * fontSize * 1.08
          if (neededH <= boxH || fontSize <= min) break
          fontSize = Math.max(min, fontSize - 1)
        }
        return (
          <div
            ref={labelRef}
            className="nodrag nopan"
            contentEditable
            dir="ltr"
            role="textbox"
            suppressContentEditableWarning
            onFocus={() => setIsEditing(true)}
            onBlur={(e) => {
              setIsEditing(false)
              data.onPatch?.(id, { name: e.currentTarget.textContent ?? '' })
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onInput={(e) => data.onPatch?.(id, { name: e.currentTarget.textContent ?? '' })}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: boxW,
              height: boxH,
              fontFamily: UI_FONT,
              fontSize,
              fontWeight: 600,
              textAlign: 'center',
              direction: 'ltr',
              unicodeBidi: 'normal',
              writingMode: 'horizontal-tb',
              color: textColor,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: `${2 * S}px ${4 * S}px`,
              lineHeight: 1.08,
              cursor: 'text',
              userSelect: 'text',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        )
      })()}

      {BothHandlesAtPoint('top', top, 'y', 'top')}
      {BothHandlesAtPoint('right', right, 'x', 'right')}
      {BothHandlesAtPoint('bottom', bottom, 'y', 'bottom')}
      {BothHandlesAtPoint('left', left, 'x', 'left')}

      <Dot x={top.x} y={top.y} active={hot === 'top'} />
      <Dot x={right.x} y={right.y} active={hot === 'right'} />
      <Dot x={bottom.x} y={bottom.y} active={hot === 'bottom'} />
      <Dot x={left.x} y={left.y} active={hot === 'left'} />

    </div>
  )
}
