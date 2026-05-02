'use client'

import React from 'react'

export function ProjectsEmptyState({
  isCustomer,
}: {
  isCustomer: boolean
}) {
  return (
    <>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {isCustomer ? 'No granted modules yet' : 'No processes yet'}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.68)' }}>
        {isCustomer
          ? 'Your champion needs to grant you access to at least one project module.'
          : 'Create your first process to start building PFD/PFMEA/PCP.'}
      </div>
    </>
  )
}
