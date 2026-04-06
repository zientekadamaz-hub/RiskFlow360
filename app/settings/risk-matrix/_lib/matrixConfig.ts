import type { RiskColor } from './matrixColors'

/**
 * Oś X: Detection × Occurrence – dokładnie jak na Twoim screenie.
 * Jeśli później zmienisz listę, UI i zapis dalej działają.
 */
export const DO_VALUES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 27, 28,
  30, 32, 35, 38, 40, 42, 45, 48, 49, 50, 54, 56, 60, 63, 64, 70, 72, 80, 81,
  90, 100,
] as const

/**
 * Oś Y: Severity (10 na górze -> 1 na dole)
 */
export const SEVERITIES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const

/**
 * Domyślny kolor (punkt startowy zanim klikniesz / zanim wczyta z DB).
 * To możesz potem ignorować, bo DB nadpisze.
 */
export function defaultColor(sev: number, doVal: number): RiskColor {
  // prosta, czytelna heurystyka "im wyżej tym gorzej"
  // możesz zmienić progi kiedy chcesz
  const score = doVal + (sev - 1) * 3

  if (score <= 24) return 'green'
  if (score <= 40) return 'yellow'
  if (score <= 60) return 'orange'
  return 'red'
}

/**
 * Helper do klucza komórki w UI
 */
export function cellKey(sev: number, doVal: number) {
  return `${sev}|${doVal}`
}
