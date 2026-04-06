import React from 'react'
import { DOT } from './const'

export function Dot({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <div
      className={`pfd-dot ${active ? 'is-active' : ''}`}
      style={{
        position: 'absolute',
        left: x - DOT / 2,
        top: y - DOT / 2,
        width: DOT,
        height: DOT,
        borderRadius: 999,
        background: '#6b7280',
        pointerEvents: 'none',
      }}
    />
  )
}
