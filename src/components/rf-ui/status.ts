import type { CSSProperties } from 'react'

import { settingsProcessAccent } from './tokens'

export function settingsInlineStatusStyle(status: string): CSSProperties {
  const normalized = status.toLowerCase()
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }

  if (normalized === 'open') return { ...base, color: '#16a34a' }
  if (normalized === 'active') return { ...base, color: '#16a34a' }
  if (normalized === 'inactive') return { ...base, color: 'rgba(255,255,255,0.58)' }
  if (normalized === 'noactive') return { ...base, color: 'rgba(255,255,255,0.58)' }
  if (normalized === 'pending') return { ...base, color: settingsProcessAccent }
  if (normalized === 'draft') return { ...base, color: '#6b7280' }
  if (normalized === 'obsolete') return { ...base, color: '#b91c1c' }
  return { ...base, color: '#f8fafc' }
}

