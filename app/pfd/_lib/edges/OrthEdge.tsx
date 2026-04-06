'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from 'reactflow'
import { S } from '../ui/const'

const DEFAULT_BORDER_RADIUS = Math.max(8, Math.round(14 * S))
const DEFAULT_OFFSET = Math.round(15 * S)
const HANDLE_SIZE = 14 * S
const ALIGN_TOL = Math.max(1, Math.round(2 * S))
const MIN_EDITABLE_SEG = Math.max(18, Math.round(24 * S))

type Axis = 'x' | 'y'
type Orientation = 'horizontal' | 'vertical'

type XY = {
  x: number
  y: number
}

type LineSeg = {
  id: string
  from: XY
  to: XY
  mid: XY
  length: number
  orientation: Orientation
}

const getNum = (data: unknown, key: string): number | null => {
  if (!data || typeof data !== 'object') return null
  const raw = (data as Record<string, unknown>)[key]
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

const getBool = (data: unknown, key: string, fallback: boolean) => {
  if (!data || typeof data !== 'object') return fallback
  const raw = (data as Record<string, unknown>)[key]
  return typeof raw === 'boolean' ? raw : fallback
}

const isVerticalSide = (p?: string | null) => p === 'top' || p === 'bottom'
const isHorizontalSide = (p?: string | null) => p === 'left' || p === 'right'
const parseLineSegments = (path: string): LineSeg[] => {
  const cmdRe = /([MLQ])([^MLQ]*)/gi
  const numRe = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi
  const segments: LineSeg[] = []
  let match: RegExpExecArray | null = null
  let cur: XY | null = null

  while ((match = cmdRe.exec(path))) {
    const cmd = match[1].toUpperCase()
    const nums = (match[2].match(numRe) || []).map(Number)

    if (cmd === 'M') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cur = { x: nums[i], y: nums[i + 1] }
      }
      continue
    }

    if (cmd === 'L') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const next = { x: nums[i], y: nums[i + 1] }
        if (cur) {
          const dx = next.x - cur.x
          const dy = next.y - cur.y
          const adx = Math.abs(dx)
          const ady = Math.abs(dy)
          const len = Math.max(adx, ady)
          if (len > 0.01) {
            const orientation: Orientation = adx >= ady ? 'horizontal' : 'vertical'
            segments.push({
              id: `seg-${segments.length}`,
              from: cur,
              to: next,
              mid: { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 },
              length: len,
              orientation,
            })
          }
        }
        cur = next
      }
      continue
    }

    if (cmd === 'Q') {
      for (let i = 0; i + 3 < nums.length; i += 4) {
        cur = { x: nums[i + 2], y: nums[i + 3] }
      }
    }
  }

  return segments
}

const makePath = (p: {
  sourceX: number
  sourceY: number
  sourcePosition: EdgeProps['sourcePosition']
  targetX: number
  targetY: number
  targetPosition: EdgeProps['targetPosition']
  centerX?: number
  centerY?: number
  borderRadius: number
  offset: number
}) =>
  getSmoothStepPath({
    sourceX: p.sourceX,
    sourceY: p.sourceY,
    sourcePosition: p.sourcePosition,
    targetX: p.targetX,
    targetY: p.targetY,
    targetPosition: p.targetPosition,
    centerX: p.centerX,
    centerY: p.centerY,
    borderRadius: p.borderRadius,
    offset: p.offset,
  })

export default function OrthEdge(props: EdgeProps) {
  const rf = useReactFlow()
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ x: number; y: number; value: number; axis: Axis } | null>(null)

  const borderRadius = useMemo(() => {
    const fromPath = (props.pathOptions as { borderRadius?: number } | undefined)?.borderRadius
    return typeof fromPath === 'number' && Number.isFinite(fromPath) ? fromPath : DEFAULT_BORDER_RADIUS
  }, [props.pathOptions])

  const offset = useMemo(() => {
    const fromPath = (props.pathOptions as { offset?: number } | undefined)?.offset
    return typeof fromPath === 'number' && Number.isFinite(fromPath) ? fromPath : DEFAULT_OFFSET
  }, [props.pathOptions])

  const manualCenterX = getNum(props.data, 'centerX')
  const manualCenterY = getNum(props.data, 'centerY')
  const avgX = (props.sourceX + props.targetX) / 2
  const avgY = (props.sourceY + props.targetY) / 2
  const verticalPair = isVerticalSide(props.sourcePosition as string | null) && isVerticalSide(props.targetPosition as string | null)
  const horizontalPair = isHorizontalSide(props.sourcePosition as string | null) && isHorizontalSide(props.targetPosition as string | null)
  const alignedVertical =
    verticalPair &&
    Math.abs(props.sourceX - props.targetX) <= ALIGN_TOL
  const alignedHorizontal =
    horizontalPair &&
    Math.abs(props.sourceY - props.targetY) <= ALIGN_TOL
  const drawSourceX = alignedVertical ? avgX : props.sourceX
  const drawTargetX = alignedVertical ? avgX : props.targetX
  const drawSourceY = alignedHorizontal ? avgY : props.sourceY
  const drawTargetY = alignedHorizontal ? avgY : props.targetY
  const centerX = alignedVertical
    ? manualCenterX == null
      ? avgX
      : Math.abs(manualCenterX - avgX) <= ALIGN_TOL
        ? avgX
        : manualCenterX
    : manualCenterX ?? undefined
  const centerY = alignedHorizontal
    ? manualCenterY == null
      ? avgY
      : Math.abs(manualCenterY - avgY) <= ALIGN_TOL
        ? avgY
        : manualCenterY
    : manualCenterY ?? undefined
  const editable = getBool(props.data, 'editable', false)

  const [path, labelX, labelY] = makePath({
    sourceX: drawSourceX,
    sourceY: drawSourceY,
    sourcePosition: props.sourcePosition,
    targetX: drawTargetX,
    targetY: drawTargetY,
    targetPosition: props.targetPosition,
    centerX,
    centerY,
    borderRadius,
    offset,
  })

  const lineSegments = useMemo(() => parseLineSegments(path), [path])

  const axisSupport = useMemo(() => {
    const baseCX = centerX ?? labelX
    const baseCY = centerY ?? labelY
    const xPath = makePath({
      sourceX: drawSourceX,
      sourceY: drawSourceY,
      sourcePosition: props.sourcePosition,
      targetX: drawTargetX,
      targetY: drawTargetY,
      targetPosition: props.targetPosition,
      centerX: baseCX + 1,
      centerY,
      borderRadius,
      offset,
    })[0]
    const yPath = makePath({
      sourceX: drawSourceX,
      sourceY: drawSourceY,
      sourcePosition: props.sourcePosition,
      targetX: drawTargetX,
      targetY: drawTargetY,
      targetPosition: props.targetPosition,
      centerX,
      centerY: baseCY + 1,
      borderRadius,
      offset,
    })[0]

    return {
      x: xPath !== path,
      y: yPath !== path,
    }
  }, [
    borderRadius,
    centerX,
    centerY,
    drawSourceX,
    drawSourceY,
    drawTargetX,
    drawTargetY,
    labelX,
    labelY,
    offset,
    path,
    props.sourcePosition,
    props.targetPosition,
  ])

  const handles = useMemo(() => {
    const inner = lineSegments.filter((_, idx) => idx > 0 && idx < lineSegments.length - 1)
    const candidates = inner.filter((seg) => seg.length >= MIN_EDITABLE_SEG)

    return candidates
      .filter((seg) => {
        if (seg.orientation === 'vertical') return axisSupport.x
        return axisSupport.y
      })
      .map((seg) => {
        const axis: Axis = seg.orientation === 'vertical' ? 'x' : 'y'
        const cursor = axis === 'x' ? 'ew-resize' : 'ns-resize'
        return { ...seg, axis, cursor }
      })
  }, [axisSupport.x, axisSupport.y, lineSegments])

  const updateAxis = useCallback(
    (axis: Axis, value: number) => {
      const key = axis === 'x' ? 'centerX' : 'centerY'
      rf.setEdges((eds) =>
        eds.map((e) =>
          e.id === props.id
            ? {
                ...e,
                data: { ...(e.data ?? {}), [key]: value, routeV: 2 },
              }
            : e
        )
      )
    },
    [props.id, rf]
  )

  const onHandlePointerDown = useCallback(
    (axis: Axis, anchor: XY, e: React.PointerEvent<HTMLDivElement>) => {
      if (!editable) return
      e.preventDefault()
      e.stopPropagation()
      const zoom = rf.getZoom?.() ?? 1
      const startValue = axis === 'x' ? centerX ?? anchor.x : centerY ?? anchor.y
      dragRef.current = { x: e.clientX, y: e.clientY, value: startValue, axis }
      setDragging(true)

      const onMove = (ev: PointerEvent) => {
        const start = dragRef.current
        if (!start) return
        const dx = (ev.clientX - start.x) / zoom
        const dy = (ev.clientY - start.y) / zoom
        const delta = start.axis === 'x' ? dx : dy
        updateAxis(start.axis, start.value + delta)
      }

      const onUp = () => {
        dragRef.current = null
        setDragging(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [centerX, centerY, editable, rf, updateAxis]
  )

  return (
    <>
      <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <BaseEdge path={path} style={props.style} markerEnd={props.markerEnd} />
      </g>

      <EdgeLabelRenderer>
        {props.label ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 14 * S,
              fontWeight: 700,
              color: '#333',
              background: 'rgba(255,255,255,0.9)',
              padding: `${2 * S}px ${4 * S}px`,
              borderRadius: 4 * S,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {String(props.label)}
          </div>
        ) : null}

        {editable ? (
          handles.map((h) => (
            <div
              key={h.id}
              onPointerDown={(e) => onHandlePointerDown(h.axis, h.mid, e)}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${h.mid.x}px, ${h.mid.y}px)`,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.35)',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                cursor: h.cursor,
                opacity: hovered || dragging ? 1 : 0,
                transition: 'opacity 120ms ease',
                pointerEvents: 'all',
              }}
            />
          ))
        ) : null}
      </EdgeLabelRenderer>
    </>
  )
}
