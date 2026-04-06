export const UI_FONT = 'Calibri, "Segoe UI", Arial, sans-serif'

export const S = 1

const evenPx = (n: number) => {
  const r = Math.round(n)
  return r % 2 === 0 ? r : r + 1
}

export const BORDER_COLOR_SELECTED = '#666'
export const STROKE = 1 * S

export const SHADOW = `0px ${6 * S}px ${18 * S}px rgba(0,0,0,0.12)`
export const SHADOW_SELECTED = `0px ${10 * S}px ${26 * S}px rgba(0,0,0,0.22)`

export const BG_OK = 'rgba(0, 120, 60, 0.15)'
export const BG_ERR = 'rgba(239, 68, 68, 0.15)'
export const TEXT = '#111'
export const MUTED = '#666'

export const OP_WIDTH = evenPx(300)
export const OP_HEIGHT = evenPx(100 * 1.4)

export const DEC_W = OP_WIDTH
export const DEC_H = OP_HEIGHT

export const START_W = evenPx(OP_WIDTH * 0.8)
export const START_H = evenPx(OP_HEIGHT * 0.7)
export const TRI_W = evenPx(OP_WIDTH * 0.7)
export const TRI_H = evenPx(OP_HEIGHT * 0.75)

export const DOT = 8 * S

export const HIT = 30 * S
export const HS = HIT / 2
export const SPLIT = 0
export const CIRCLE_D = evenPx(OP_HEIGHT * 0.6) // connector reduced by 40%

export const invisibleHandle: React.CSSProperties = {
  width: HIT,
  height: HIT,
  background: 'transparent',
  border: 'none',
  opacity: 0,
  transform: 'none',
}
