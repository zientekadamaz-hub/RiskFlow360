'use client'

import React from 'react'
import { settingsCompactPrimaryButtonStyle, settingsToolbarRowStyle } from '@/features/settings/invitation-shell'

export function ProjectsToolbar({
  canManageProjects,
  createRowOpen,
  hasOrganization,
  onCreate,
}: {
  canManageProjects: boolean
  createRowOpen: boolean
  hasOrganization: boolean
  onCreate: () => void
}) {
  return (
    <div style={settingsToolbarRowStyle}>
      <button
        onClick={onCreate}
        disabled={createRowOpen || !hasOrganization || !canManageProjects}
        className="rf-button"
        style={settingsCompactPrimaryButtonStyle}
      >
        Create project
      </button>
    </div>
  )
}
