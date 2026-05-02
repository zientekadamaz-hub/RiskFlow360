'use client'

import React from 'react'
import {
  projectsCompactInputStyle,
  PROJECTS_FILTER_ACTIVE_BG,
  PROJECTS_FILTER_ACTIVE_BORDER,
  PROJECTS_FILTER_CHIP_WIDTH,
} from './view-styles'
import {
  settingsFilterChipStyle,
  settingsFilterClearButtonStyle,
  settingsFilterGroupHeaderStyle,
  settingsFilterGroupLabelStyle,
  settingsFilterGroupStyle,
  settingsFilterPanelStyle,
  settingsProcessAccent,
} from '@/components/rf-ui'

type CheckboxFilter = {
  label: string
  options: string[]
  selected: string[]
  onToggle: (value: string, checked: boolean) => void
  onClear: () => void
  emptyLabel: string
}

function CheckboxFilterGroup({ label, options, selected, onToggle, onClear, emptyLabel }: CheckboxFilter) {
  return (
    <div style={settingsFilterGroupStyle}>
      <div style={settingsFilterGroupHeaderStyle}>
        <div style={settingsFilterGroupLabelStyle}>{label}</div>
        <button onClick={onClear} className="rf-button" style={settingsFilterClearButtonStyle}>
          Clear
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {options.length === 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{emptyLabel}</span>}
        {options.map((option) => {
          const isAll = selected.length === 0
          const checked = isAll ? true : selected.includes(option)
          return (
            <label
              key={option}
              style={settingsFilterChipStyle(checked, {
                width: PROJECTS_FILTER_CHIP_WIDTH,
                activeBg: PROJECTS_FILTER_ACTIVE_BG,
                activeBorder: PROJECTS_FILTER_ACTIVE_BORDER,
              })}
            >
              <input type="checkbox" checked={checked} onChange={(event) => onToggle(option, event.target.checked)} style={{ accentColor: settingsProcessAccent }} />
              {option}
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function ProjectsFiltersPanel(props: {
  processQuery: string
  onProcessQueryChange: (value: string) => void
  onClearProcess: () => void
  productsQuery: string
  onProductsQueryChange: (value: string) => void
  onClearProducts: () => void
  siteOptions: string[]
  selectedSites: string[]
  onToggleSite: (value: string, checked: boolean) => void
  onClearSites: () => void
  departmentOptions: string[]
  selectedDepartments: string[]
  onToggleDepartment: (value: string, checked: boolean) => void
  onClearDepartments: () => void
  statusOptions: string[]
  selectedStatuses: string[]
  onToggleStatus: (value: string, checked: boolean) => void
  onClearStatuses: () => void
}) {
  const {
    processQuery,
    onProcessQueryChange,
    onClearProcess,
    productsQuery,
    onProductsQueryChange,
    onClearProducts,
    siteOptions,
    selectedSites,
    onToggleSite,
    onClearSites,
    departmentOptions,
    selectedDepartments,
    onToggleDepartment,
    onClearDepartments,
    statusOptions,
    selectedStatuses,
    onToggleStatus,
    onClearStatuses,
  } = props

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={settingsFilterPanelStyle}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={settingsFilterGroupStyle}>
            <div style={settingsFilterGroupHeaderStyle}>
              <div style={settingsFilterGroupLabelStyle}>Process name</div>
              <button onClick={onClearProcess} className="rf-button" style={settingsFilterClearButtonStyle}>
                Clear
              </button>
            </div>
            <input
              value={processQuery}
              onChange={(event) => onProcessQueryChange(event.target.value)}
              placeholder="Search process..."
              style={projectsCompactInputStyle}
            />
          </div>

          <div style={settingsFilterGroupStyle}>
            <div style={settingsFilterGroupHeaderStyle}>
              <div style={settingsFilterGroupLabelStyle}>Products</div>
              <button onClick={onClearProducts} className="rf-button" style={settingsFilterClearButtonStyle}>
                Clear
              </button>
            </div>
            <input
              value={productsQuery}
              onChange={(event) => onProductsQueryChange(event.target.value)}
              placeholder="Search products..."
              style={projectsCompactInputStyle}
            />
          </div>

          <CheckboxFilterGroup
            label="Site filter"
            options={siteOptions}
            selected={selectedSites}
            onToggle={onToggleSite}
            onClear={onClearSites}
            emptyLabel="No sites"
          />

          <CheckboxFilterGroup
            label="Department filter"
            options={departmentOptions}
            selected={selectedDepartments}
            onToggle={onToggleDepartment}
            onClear={onClearDepartments}
            emptyLabel="No departments"
          />

          <CheckboxFilterGroup
            label="Status filter"
            options={statusOptions}
            selected={selectedStatuses}
            onToggle={onToggleStatus}
            onClear={onClearStatuses}
            emptyLabel="No statuses"
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.68)' }}>Your settings will be remembered.</div>
      </div>
    </div>
  )
}
