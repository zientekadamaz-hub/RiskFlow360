import React, { useLayoutEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Dot } from '../ui/Dot'

import { S, STROKE, UI_FONT, CIRCLE_D, HIT, SPLIT } from '../ui/const'
import type { PfdData } from './types'

export default function CircleNode({ id, data, selected }: NodeProps<PfdData>) {
  const [hot, setHot] = useState<null | 'top' | 'right' | 'bottom' | 'left'>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)

  const d = CIRCLE_D
  const r = d / 2
  const text = data.name ?? ''
  const displayText = text || '00'
  const boxW = Math.max(30 * S, d * 0.66)
  const boxH = Math.max(22 * S, d * 0.5)
  const base = 23 * S
  const min = 10 * S
  let fontSize = base
  const maxIters = 12
  for (let i = 0; i < maxIters; i += 1) {
    const charsPerLine = Math.max(4, Math.floor(boxW / (fontSize * 0.6)))
    const lines = Math.max(1, Math.ceil((text || '00').length / charsPerLine))
    const neededH = lines * fontSize * 1.08
    if (neededH <= boxH || fontSize <= min) break
    fontSize = Math.max(min, fontSize - 1)
  }

  const centerX = r
  const centerY = r
  const top = { x: centerX, y: 0 }
  const right = { x: d, y: centerY }
  const bottom = { x: centerX, y: d }
  const left = { x: 0, y: centerY }

  const fillColor = 'rgba(232,243,237,0.96)'
  const stroke = selected ? 'rgba(78,124,98,0.58)' : 'rgba(107,145,125,0.42)'
  const textColor = '#424a5f'
  const handleHit = 18 * S
  const handleHalf = handleHit / 2
  const handleStyle: React.CSSProperties = {
    width: handleHit,
    height: handleHit,
    background: 'transparent',
    border: 'none',
    opacity: 0,
    transform: 'none',
  }
  const handlePosition = {
    top: Position.Top,
    right: Position.Right,
    bottom: Position.Bottom,
    left: Position.Left,
  } as const
  const bothHandlesAtPoint = (idBase: 'top' | 'right' | 'bottom' | 'left', p: { x: number; y: number }, axis: 'x' | 'y') => {
    const dxS = axis === 'x' ? SPLIT : 0
    const dyS = axis === 'y' ? SPLIT : 0
    const dxT = axis === 'x' ? -SPLIT : 0
    const dyT = axis === 'y' ? -SPLIT : 0
    return (
      <>
        <Handle
          id={`${idBase}-t`}
          type="target"
          position={handlePosition[idBase]}
          style={{ ...handleStyle, left: p.x - handleHalf + dxT, top: p.y - handleHalf + dyT }}
        />
        <Handle
          id={`${idBase}-s`}
          type="source"
          position={handlePosition[idBase]}
          style={{ ...handleStyle, left: p.x - handleHalf + dxS, top: p.y - handleHalf + dyS }}
        />
      </>
    )
  }

  useLayoutEffect(() => {
    if (isEditing) return
    const el = labelRef.current
    if (!el) return
    if ((el.textContent ?? '') !== displayText) el.textContent = displayText
  }, [displayText, isEditing])

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const sx = rect.width / d
        const sy = rect.height / d
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
        setHot(bestDist <= HIT * 0.7 ? best : null)
      }}
      onMouseLeave={() => setHot(null)}
      style={{
        width: d,
        height: d,
        position: 'relative',
        cursor: data.editable ? 'grab' : 'default',
        userSelect: 'none',
        fontFamily: UI_FONT,
        ['--pfd-dot-color' as any]: stroke,
      }}
    >
      <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <circle
          cx={r}
          cy={r}
          r={r - STROKE / 2}
          fill={fillColor}
          stroke={stroke}
          strokeWidth={STROKE}
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
        onFocus={(e) => {
          setIsEditing(true)
          if (!text && e.currentTarget.textContent === '00') e.currentTarget.textContent = ''
        }}
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

      {bothHandlesAtPoint('top', top, 'y')}
      {bothHandlesAtPoint('right', right, 'x')}
      {bothHandlesAtPoint('bottom', bottom, 'y')}
      {bothHandlesAtPoint('left', left, 'x')}

      <Dot x={top.x} y={top.y} active={hot === 'top'} />
      <Dot x={right.x} y={right.y} active={hot === 'right'} />
      <Dot x={bottom.x} y={bottom.y} active={hot === 'bottom'} />
      <Dot x={left.x} y={left.y} active={hot === 'left'} />

    </div>
  )
}
