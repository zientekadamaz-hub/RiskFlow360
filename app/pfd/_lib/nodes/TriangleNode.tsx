'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'
import type { NodeProps } from 'reactflow'
import { Dot } from '../ui/Dot'
import { BothHandlesAtPoint } from '../ui/handles'
import { HIT, S, STROKE, TRI_H, TRI_W, UI_FONT } from '../ui/const'
import type { PfdData } from './types'

export default function TriangleNode({ id, data, selected }: NodeProps<PfdData>) {
  const [hot, setHot] = useState<null | 'right' | 'bottom' | 'left'>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)

  const w = TRI_W
  const h = TRI_H
  const text = data.name ?? 'Storage'

  const topV = { x: w / 2, y: 0 }
  const leftV = { x: 0, y: h }
  const rightV = { x: w, y: h }

  // Midpoints of triangle sides.
  const right = { x: (topV.x + rightV.x) / 2, y: (topV.y + rightV.y) / 2 }
  const bottom = { x: (leftV.x + rightV.x) / 2, y: (leftV.y + rightV.y) / 2 }
  const left = { x: (topV.x + leftV.x) / 2, y: (topV.y + leftV.y) / 2 }
  const boxW = Math.max(80 * S, w * 0.46)
  const boxH = Math.max(44 * S, h * 0.3)
  const base = 16 * S
  const min = 10 * S
  let fontSize = base
  for (let i = 0; i < 12; i += 1) {
    const charsPerLine = Math.max(4, Math.floor(boxW / (fontSize * 0.58)))
    const lines = Math.max(1, Math.ceil((text || 'Storage').length / charsPerLine))
    const neededH = lines * fontSize * 1.08
    if (neededH <= boxH || fontSize <= min) break
    fontSize = Math.max(min, fontSize - 1)
  }

  useLayoutEffect(() => {
    if (isEditing) return
    const el = labelRef.current
    if (!el) return
    if ((el.textContent ?? '') !== text) el.textContent = text
  }, [isEditing, text])

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const sx = rect.width / w
        const sy = rect.height / h
        const x = (e.clientX - rect.left) / (sx || 1)
        const y = (e.clientY - rect.top) / (sy || 1)
        const pts = { right, bottom, left } as const
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
        setHot(bestDist <= HIT * 1.4 ? best : null)
      }}
      onMouseLeave={() => setHot(null)}
      style={{
        width: w,
        height: h,
        position: 'relative',
        cursor: data.editable ? 'grab' : 'default',
        userSelect: 'none',
        fontFamily: UI_FONT,
        ['--pfd-dot-color' as any]: selected ? 'rgba(78,124,98,0.58)' : 'rgba(107,145,125,0.42)',
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path
          d={`M ${topV.x} ${topV.y} L ${rightV.x} ${rightV.y} L ${leftV.x} ${leftV.y} Z`}
          fill="rgba(232,243,237,0.96)"
          stroke={selected ? 'rgba(78,124,98,0.58)' : 'rgba(107,145,125,0.42)'}
          strokeWidth={STROKE}
          strokeLinejoin="round"
          style={{
            filter: selected
              ? 'drop-shadow(0px 10px 26px rgba(0,0,0,0.22))'
              : 'drop-shadow(0px 6px 18px rgba(0,0,0,0.12))',
          }}
        />
      </svg>

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
          top: '68%',
          transform: 'translate(-50%, -50%)',
          width: boxW,
          height: boxH,
          fontFamily: UI_FONT,
          fontSize,
          fontWeight: 600,
          textAlign: 'center',
          color: '#424a5f',
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

      {BothHandlesAtPoint('right', right, 'x', 'right')}
      {BothHandlesAtPoint('bottom', bottom, 'y', 'bottom')}
      {BothHandlesAtPoint('left', left, 'x', 'left')}

      <Dot x={right.x} y={right.y} active={hot === 'right'} />
      <Dot x={bottom.x} y={bottom.y} active={hot === 'bottom'} />
      <Dot x={left.x} y={left.y} active={hot === 'left'} />
    </div>
  )
}
