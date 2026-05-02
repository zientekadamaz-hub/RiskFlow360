import type { RiskColor } from './matrix-colors'

export const DO_VALUES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 27, 28,
  30, 32, 35, 38, 40, 42, 45, 48, 49, 50, 54, 56, 60, 63, 64, 70, 72, 80, 81,
  90, 100,
] as const

export const SEVERITIES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const

export function cellKey(severity: number, doValue: number) {
  return `${severity}|${doValue}`
}

export function defaultColor(severity: number, doValue: number): RiskColor {
  const score = doValue + (severity - 1) * 3

  if (score <= 24) return 'green'
  if (score <= 40) return 'yellow'
  if (score <= 60) return 'orange'
  return 'red'
}
