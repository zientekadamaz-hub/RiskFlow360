export const CALENDAR_WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const
export const CALENDAR_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export function parseIsoDateParts(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [year, month, day] = raw.split('-').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month: month - 1, day }
}

export function formatIsoDate(year: number, month: number, day: number) {
  const yyyy = String(year).padStart(4, '0')
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export function getCalendarCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const leading = (firstWeekday + 6) % 7
  const totalDays = getDaysInMonth(year, month)
  const cells: Array<{ key: string; day: number | null }> = []

  for (let i = 0; i < leading; i += 1) {
    cells.push({ key: `empty-start-${i}`, day: null })
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ key: `day-${year}-${month}-${day}`, day })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${cells.length}`, day: null })
  }
  return cells
}

export function todayIsoDate() {
  const now = new Date()
  return formatIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}
