import type React from 'react'

export function anchoredPopupStyle(
  anchorEl: HTMLElement | null,
  width: number,
  topGap = 0,
  maxHeight = 280,
  openAboveAnchorEl?: HTMLElement | null
): React.CSSProperties {
  if (typeof window === 'undefined' || !anchorEl) {
    return {
      position: 'fixed',
      top: 0,
      left: 0,
      width,
      maxHeight,
      visibility: 'hidden',
      pointerEvents: 'none',
    }
  }

  const rect = anchorEl.getBoundingClientRect()
  const openAboveRect = (openAboveAnchorEl ?? anchorEl).getBoundingClientRect()
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  const desiredHeight = Math.min(maxHeight, Math.max(160, window.innerHeight - 24))
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - topGap - 12)
  const spaceAbove = Math.max(0, openAboveRect.top - topGap - 12)
  const openAbove = spaceBelow < Math.min(desiredHeight, 220) && spaceAbove > spaceBelow
  const effectiveMaxHeight = Math.min(desiredHeight, Math.max(120, openAbove ? spaceAbove : spaceBelow))

  if (openAbove) {
    return {
      position: 'fixed',
      bottom: window.innerHeight - openAboveRect.top + topGap,
      left,
      width,
      maxHeight: effectiveMaxHeight,
    }
  }

  return {
    position: 'fixed',
    top: rect.bottom + topGap,
    left,
    width,
    maxHeight: effectiveMaxHeight,
  }
}

export function adjacentPopupStyle(
  anchorEl: HTMLElement | null,
  width: number,
  anchorWidth: number,
  gap = 8,
  maxHeight = 280
): React.CSSProperties {
  if (typeof window === 'undefined' || !anchorEl) {
    return {
      position: 'fixed',
      top: 0,
      left: 0,
      width,
      maxHeight,
      visibility: 'hidden',
      pointerEvents: 'none',
    }
  }

  const rect = anchorEl.getBoundingClientRect()
  const anchorLeft = Math.max(12, Math.min(rect.left, window.innerWidth - anchorWidth - 12))
  const rightLeft = anchorLeft + anchorWidth + gap
  const hasRoomOnRight = rightLeft + width <= window.innerWidth - 12
  const left = hasRoomOnRight ? rightLeft : Math.max(12, anchorLeft - gap - width)

  return {
    position: 'fixed',
    top: rect.bottom,
    left,
    width,
    maxHeight,
  }
}
