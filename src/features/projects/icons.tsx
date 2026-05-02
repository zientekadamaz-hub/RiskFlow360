import React from 'react'

export function ProjectsFilterIcon({ active }: { active: boolean }) {
  const stroke = active ? '#16a34a' : '#9ca3af'
  const fill = active ? 'rgba(22,163,74,0.35)' : 'none'

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 5h18l-7 8v5l-4 1v-6L3 5z"
        stroke={stroke}
        fill={fill}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProjectsRevisionHintIcon({ active }: { active: boolean }) {
  const stroke = '#9ca3af'
  const fill = active ? 'rgba(156,163,175,0.16)' : 'none'

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke={stroke} fill={fill} strokeWidth="1.5" />
      <path d="M4.5 7l7.5 6L19.5 7" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
