export function roundedDiamondPath(w: number, h: number, r: number) {
  const p0 = { x: w / 2, y: 0 }
  const p1 = { x: w, y: h / 2 }
  const p2 = { x: w / 2, y: h }
  const p3 = { x: 0, y: h / 2 }
  const pts = [p0, p1, p2, p3]

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  })

  const corners = pts.map((v, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length]
    const next = pts[(i + 1) % pts.length]
    const dPrev = dist(v, prev)
    const dNext = dist(v, next)
    const tPrev = Math.min(0.5, r / dPrev)
    const tNext = Math.min(0.5, r / dNext)
    const a = lerp(v, prev, tPrev)
    const b = lerp(v, next, tNext)
    return { v, a, b }
  })

  let d = `M ${corners[0].b.x} ${corners[0].b.y}`
  for (let i = 1; i < corners.length + 1; i++) {
    const c = corners[i % corners.length]
    d += ` L ${c.a.x} ${c.a.y}`
    d += ` Q ${c.v.x} ${c.v.y} ${c.b.x} ${c.b.y}`
  }
  d += ' Z'
  return d
}
