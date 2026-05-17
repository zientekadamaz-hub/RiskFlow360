'use client'

import { settingsInputStyle } from '@/components/rf-ui'
import { StandardSelect } from '@/features/settings/StandardSelect'

export type ReportFilterOption = { label: string; value: string } | string

export function ReportFilterSelect({
  allLabel,
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  allLabel?: string
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  options: ReportFilterOption[]
  value: string
}) {
  const normalizedOptions = options.map((option) => (typeof option === 'string' ? { label: option, value: option } : option))
  const selectOptions = allLabel ? [{ label: allLabel, value: '' }, ...normalizedOptions] : normalizedOptions

  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 220 }}>
      <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <StandardSelect
        ariaLabel={label}
        disabled={disabled}
        onChange={onChange}
        options={selectOptions}
        placeholder={allLabel}
        style={{ ...settingsInputStyle, height: 34 }}
        value={value}
      />
    </label>
  )
}
