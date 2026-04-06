'use client'

import React, { useState } from 'react'
import type { NodeProps } from 'reactflow'
import { NodeResizer } from 'reactflow'
import { UI_FONT, S } from '../ui/const'
import type { PfdData } from './types'

const MIN_W = 160
const MIN_H = 100

export default function FrameNode({ id, data, selected }: NodeProps<PfdData>) {
  const [hovered, setHovered] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [draftSize, setDraftSize] = useState<{ w: number; h: number } | null>(null)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const w = Math.max(MIN_W, draftSize?.w ?? data.frameW ?? 360)
  const h = Math.max(MIN_H, draftSize?.h ?? data.frameH ?? 220)
  const canDrag = !!data.editable
  const label = data.frameLabel ?? ''
  const labelMeasure = label.trim() || 'Description...'
  const labelBase = 23 * S
  const labelMin = 10 * S
  const labelWidth = Math.max(96 * S, Math.min(180 * S, w * 0.34))
  let labelFontSize = labelBase
  for (let i = 0; i < 12; i += 1) {
    const estimated = labelMeasure.length * labelFontSize * 0.56
    if (estimated <= Math.max(40, labelWidth - 12 * S) || labelFontSize <= labelMin) break
    labelFontSize = Math.max(labelMin, labelFontSize - 0.5 * S)
  }
  const labelHeight = Math.max(24 * S, labelFontSize * 1.25)
  const active = selected || hovered || resizing
  const borderColor = active ? '#f8fbff' : '#dbe7f5'
  const resizeBand = 5
  const moveBandStart = 5
  const moveBandEnd = 30
  const moveBand = moveBandEnd - moveBandStart
  const resizeLineHit = resizeBand
  const resizeHandleSize = 14
  const passRightClickToCanvas = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 2) return
    e.preventDefault()
    e.stopPropagation()
    const el = rootRef.current
    if (!el) return
    const prevPointer = el.style.pointerEvents
    el.style.pointerEvents = 'none'
    const below = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    if (below) {
      below.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 2,
          buttons: e.buttons || 2,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        }),
      )
    }
    const restore = () => {
      el.style.pointerEvents = prevPointer || 'none'
      window.removeEventListener('mouseup', restore, true)
    }
    window.addEventListener('mouseup', restore, true)
  }

  return (
    <div
      ref={rootRef}
      onMouseDown={passRightClickToCanvas}
      style={{
        width: w,
        height: h,
        position: 'relative',
        fontFamily: UI_FONT,
        color: '#424a5f',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `2px dashed ${borderColor}`,
          borderRadius: 10,
          boxShadow: 'none',
          pointerEvents: 'none',
        }}
      />

      <div
        className="frame-drag-handle"
        onMouseDown={passRightClickToCanvas}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: moveBandStart,
          height: moveBand,
          cursor: canDrag ? 'grab' : 'default',
          pointerEvents: !canDrag || resizing ? 'none' : 'all',
        }}
      />
      <div
        className="frame-drag-handle"
        onMouseDown={passRightClickToCanvas}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: moveBandStart,
          height: moveBand,
          cursor: canDrag ? 'grab' : 'default',
          pointerEvents: !canDrag || resizing ? 'none' : 'all',
        }}
      />
      <div
        className="frame-drag-handle"
        onMouseDown={passRightClickToCanvas}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: moveBandStart,
          width: moveBand,
          cursor: canDrag ? 'grab' : 'default',
          pointerEvents: !canDrag || resizing ? 'none' : 'all',
        }}
      />
      <div
        className="frame-drag-handle"
        onMouseDown={passRightClickToCanvas}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: moveBandStart,
          width: moveBand,
          cursor: canDrag ? 'grab' : 'default',
          pointerEvents: !canDrag || resizing ? 'none' : 'all',
        }}
      />

      <div style={{ pointerEvents: 'all' }}>
        <NodeResizer
          color="transparent"
          isVisible={canDrag}
          minWidth={MIN_W}
          minHeight={MIN_H}
          // Keep visible frame border thin (custom border above), but make resize hit-zone wider.
          lineStyle={{ borderColor: 'transparent', borderWidth: resizeLineHit, pointerEvents: 'all' }}
          handleStyle={{
            width: resizeHandleSize,
            height: resizeHandleSize,
            borderRadius: 3,
            backgroundColor: active ? '#f8fbff' : 'transparent',
          }}
          onResizeStart={() => {
            setResizing(true)
            setDraftSize({ w, h })
          }}
          onResize={(_, params) => {
            setDraftSize({ w: Math.max(MIN_W, params.width), h: Math.max(MIN_H, params.height) })
          }}
          onResizeEnd={(_, params) => {
            setResizing(false)
            setDraftSize(null)
            data.onPatch?.(id, { frameW: params.width, frameH: params.height })
          }}
        />
      </div>

      <input
        value={label}
        onMouseDown={passRightClickToCanvas}
        onContextMenu={(e) => e.preventDefault()}
        onChange={(e) => data.onPatch?.(id, { frameLabel: e.target.value })}
        placeholder="Description..."
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          width: labelWidth,
          height: labelHeight,
          pointerEvents: 'all',
          fontSize: labelFontSize,
          fontWeight: 600,
          lineHeight: 1.08,
          fontFamily: UI_FONT,
          textAlign: 'center',
          color: '#424a5f',
          border: 'none',
          borderRadius: 7,
          padding: '0 8px',
          background: 'rgba(255,255,255,0.62)',
          outline: 'none',
        }}
      />

    </div>
  )
}
