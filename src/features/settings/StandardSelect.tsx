'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import {
  settingsCompactInputStyle,
  settingsInputStyle,
  settingsPopupItemStyle,
  settingsPopupPanelStyle,
  settingsPopupText,
  settingsSharedOverlayBorder,
  settingsSurfaceRadius,
} from './invitation-shell'

export type StandardSelectOption = {
  disabled?: boolean
  label: string
  value: string
}

type StandardSelectProps = {
  ariaLabel?: string
  compact?: boolean
  disabled?: boolean
  onChange: (value: string) => void
  options: StandardSelectOption[]
  placeholder?: string
  style?: CSSProperties
  value: string
}

type PopupRect = {
  left: number
  minWidth: number
  top: number
}

const popupMaxHeight = 240

function findSelectedOption(options: StandardSelectOption[], value: string) {
  return options.find((option) => option.value === value)
}

export function StandardSelect({
  ariaLabel,
  compact = false,
  disabled = false,
  onChange,
  options,
  placeholder = 'Select...',
  style,
  value,
}: StandardSelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [popupRect, setPopupRect] = useState<PopupRect | null>(null)
  const selected = findSelectedOption(options, value)
  const label = selected?.label || placeholder
  const inputStyle = compact ? settingsCompactInputStyle : settingsInputStyle

  const close = useCallback(() => setOpen(false), [])

  const updatePopupRect = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    setPopupRect({
      left: rect.left,
      minWidth: rect.width,
      top: rect.bottom + 4,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePopupRect()
  }, [open, updatePopupRect])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      close()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('resize', updatePopupRect)
    window.addEventListener('scroll', updatePopupRect, true)
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('resize', updatePopupRect)
      window.removeEventListener('scroll', updatePopupRect, true)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [close, open, updatePopupRect])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
        style={{
          ...inputStyle,
          ...style,
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          opacity: disabled ? 0.62 : 1,
          paddingRight: 8,
          textAlign: 'left',
        }}
      >
        <span
          style={{
            color: selected ? inputStyle.color : 'rgba(255,255,255,0.48)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span style={{ color: settingsPopupText, fontSize: 10, lineHeight: 1, marginLeft: 8 }}>▼</span>
      </button>

      {typeof document !== 'undefined' && open && popupRect
        ? createPortal(
            <div
              ref={popupRef}
              role="listbox"
              style={{
                ...settingsPopupPanelStyle,
                boxSizing: 'border-box',
                left: popupRect.left,
                maxHeight: popupMaxHeight,
                minWidth: popupRect.minWidth,
                overflowY: 'auto',
                padding: 5,
                position: 'fixed',
                top: popupRect.top,
                width: popupRect.minWidth,
                zIndex: 10000,
              }}
            >
              {options.length === 0 ? (
                <div
                  style={{
                    border: `1px solid ${settingsSharedOverlayBorder}`,
                    borderRadius: settingsSurfaceRadius,
                    color: 'rgba(217,168,108,0.58)',
                    fontSize: 12,
                    padding: '7px 8px',
                  }}
                >
                  No options
                </div>
              ) : (
                options.map((option) => {
                  const selectedOption = option.value === value
                  return (
                    <button
                      key={`${option.value}-${option.label}`}
                      type="button"
                      disabled={option.disabled}
                      role="option"
                      aria-selected={selectedOption}
                      onClick={() => {
                        if (option.disabled) return
                        onChange(option.value)
                        close()
                      }}
                      className="settings-popup-button"
                      style={{
                        ...settingsPopupItemStyle(selectedOption),
                        opacity: option.disabled ? 0.5 : 1,
                        cursor: option.disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })
              )}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
