export type RiskColor = 'green' | 'yellow' | 'orange' | 'red'

export const COLOR_ORDER: RiskColor[] = ['green', 'yellow', 'orange', 'red']

export const colorToBg: Record<RiskColor, string> = {
  green: '#7bd77b',
  yellow: '#fff06a',
  orange: '#ffb347',
  red: '#ff4d4d',
}

export const colorToLabel: Record<RiskColor, string> = {
  green: 'GREEN - action not required',
  yellow: 'YELLOW',
  orange: 'Pomarańczowy',
  red: 'Czerwony',
}

export function nextColor(c: RiskColor): RiskColor {
  const idx = COLOR_ORDER.indexOf(c)
  return COLOR_ORDER[(idx + 1) % COLOR_ORDER.length]
}
