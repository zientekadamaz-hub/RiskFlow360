'use client'

import React from 'react'
import Link from 'next/link'

import type { HeaderMenuItem } from './app-header-model'
import {
  adminMenuItems,
  reportsMenuItems,
  settingsMenuItems,
} from './app-header-model'
import type { MenuKey } from './HeaderNavigation'

type HeaderDropdownMenuProps = {
  canSeeAdmin: boolean
  canSeeSettings: boolean
  clearCloseTimer: () => void
  closeAll: () => void
  hoverDrop: string | null
  openMenu: Exclude<MenuKey, null>
  scheduleCloseMenu: () => void
  setHoverDrop: (key: string | null) => void
  sharedOverlayBg: string
  sharedOverlayBorder: string
  submenuPosition: { left: number; top: number }
}

function menuLabelFor(openMenu: Exclude<MenuKey, null>) {
  if (openMenu === 'reports') return 'Reports menu'
  if (openMenu === 'admin') return 'Admin menu'
  return 'Settings menu'
}

function itemsFor(openMenu: Exclude<MenuKey, null>, canSeeSettings: boolean, canSeeAdmin: boolean) {
  if (openMenu === 'reports') return reportsMenuItems
  if (openMenu === 'settings' && canSeeSettings) return settingsMenuItems
  if (openMenu === 'admin' && canSeeAdmin) return adminMenuItems
  return []
}

export function HeaderDropdownMenu({
  canSeeAdmin,
  canSeeSettings,
  clearCloseTimer,
  closeAll,
  hoverDrop,
  openMenu,
  scheduleCloseMenu,
  setHoverDrop,
  sharedOverlayBg,
  sharedOverlayBorder,
  submenuPosition,
}: HeaderDropdownMenuProps) {
  const dropLinkStyle = (key: string): React.CSSProperties => ({
    display: 'block',
    fontSize: 14,
    fontWeight: 650,
    color: '#fff',
    textDecoration: hoverDrop === key ? 'underline' : 'none',
    textUnderlineOffset: 6,
    textDecorationThickness: 2,
    padding: '8px 10px',
    whiteSpace: 'nowrap',
    background: 'transparent',
  })

  const renderMenuItems = (items: HeaderMenuItem[]) =>
    items.map((item) => (
      <Link
        key={item.key}
        href={item.href}
        role="menuitem"
        style={dropLinkStyle(item.key)}
        onMouseEnter={() => setHoverDrop(item.key)}
        onMouseLeave={() => setHoverDrop(null)}
        onClick={closeAll}
      >
        {item.label}
      </Link>
    ))

  return (
    <div
      role="menu"
      aria-label={menuLabelFor(openMenu)}
      style={{
        position: 'fixed',
        left: submenuPosition.left,
        top: submenuPosition.top,
        zIndex: 55,
        background: sharedOverlayBg,
        border: `1px solid ${sharedOverlayBorder}`,
        boxShadow: '0 14px 28px rgba(0,0,0,0.10)',
        padding: '8px',
        width: 'max-content',
        minWidth: 220,
        maxWidth: 'min(320px, calc(100vw - 24px))',
      }}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleCloseMenu}
    >
      <div style={{ display: 'grid', gap: 2, width: 'max-content' }}>
        {renderMenuItems(itemsFor(openMenu, canSeeSettings, canSeeAdmin))}
      </div>
    </div>
  )
}
