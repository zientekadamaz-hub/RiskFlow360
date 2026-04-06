import React from 'react'
import { Handle, Position } from 'reactflow'
import { HIT, HS, SPLIT, invisibleHandle } from './const'

/**
 * Dwa uchwyty w tym samym miejscu:
 * - target i source
 * - minimalne przesunięcie (SPLIT), żeby ReactFlow rozróżniał połączenia
 */
export function BothHandlesAtPoint(
  idBase: string,
  p: { x: number; y: number },
  axis: 'x' | 'y',
  pos: 'top' | 'right' | 'bottom' | 'left'
) {
  const handlePosition = {
    top: Position.Top,
    right: Position.Right,
    bottom: Position.Bottom,
    left: Position.Left,
  } as const
  const dxS = axis === 'x' ? SPLIT : 0
  const dyS = axis === 'y' ? SPLIT : 0
  const dxT = axis === 'x' ? -SPLIT : 0
  const dyT = axis === 'y' ? -SPLIT : 0

  return (
    <>
      <Handle
        id={`${idBase}-t`}
        type="target"
        position={handlePosition[pos]}
        style={{ ...invisibleHandle, left: p.x - HS + dxT, top: p.y - HS + dyT }}
      />
      <Handle
        id={`${idBase}-s`}
        type="source"
        position={handlePosition[pos]}
        style={{ ...invisibleHandle, left: p.x - HS + dxS, top: p.y - HS + dyS }}
      />
    </>
  )
}

/**
 * Dla wygody: eksport pomocniczy gdybyś chciał kiedyś inne hitboxy
 */
export const HANDLE_HIT = HIT
