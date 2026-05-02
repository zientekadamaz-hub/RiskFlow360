'use client'

import React from 'react'
import Link from 'next/link'

export type MenuKey = null | 'reports' | 'settings' | 'admin'
export type HoverKey = null | 'projects' | 'reports' | 'tasks' | 'settings' | 'admin'

type HeaderNavigationProps = {
  adminRef: React.RefObject<HTMLSpanElement | null>
  canSeeAdmin: boolean
  canSeeSettings: boolean
  closeAll: () => void
  openMenu: MenuKey
  openMenuNow: (menu: Exclude<MenuKey, null>) => void
  reportsRef: React.RefObject<HTMLSpanElement | null>
  scheduleCloseMenu: () => void
  setHoverNav: (key: HoverKey) => void
  settingsRef: React.RefObject<HTMLSpanElement | null>
  styleFor: (key: Exclude<HoverKey, null>) => React.CSSProperties
}

export function HeaderNavigation({
  adminRef,
  canSeeAdmin,
  canSeeSettings,
  closeAll,
  openMenu,
  openMenuNow,
  reportsRef,
  scheduleCloseMenu,
  setHoverNav,
  settingsRef,
  styleFor,
}: HeaderNavigationProps) {
  const menuKeyHandler =
    (menu: Exclude<MenuKey, null>) =>
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      if (openMenu === menu) {
        closeAll()
        return
      }
      openMenuNow(menu)
    }

  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        fontSize: 14,
        fontWeight: 550,
        minHeight: 32,
      }}
    >
      <Link
        href="/projects"
        style={styleFor('projects')}
        onMouseEnter={() => {
          setHoverNav('projects')
          scheduleCloseMenu()
        }}
        onMouseLeave={() => setHoverNav(null)}
        onClick={closeAll}
      >
        Projects
      </Link>

      <span
        ref={reportsRef}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={openMenu === 'reports'}
        style={styleFor('reports')}
        onMouseEnter={() => {
          setHoverNav('reports')
          openMenuNow('reports')
        }}
        onMouseLeave={() => setHoverNav(null)}
        onClick={() => (openMenu === 'reports' ? closeAll() : openMenuNow('reports'))}
        onKeyDown={menuKeyHandler('reports')}
      >
        Reports
      </span>

      <Link
        href="/task-management"
        style={styleFor('tasks')}
        onMouseEnter={() => {
          setHoverNav('tasks')
          scheduleCloseMenu()
        }}
        onMouseLeave={() => setHoverNav(null)}
        onClick={closeAll}
      >
        Tasks
      </Link>

      {canSeeSettings ? (
        <span
          ref={settingsRef}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'settings'}
          style={styleFor('settings')}
          onMouseEnter={() => {
            setHoverNav('settings')
            openMenuNow('settings')
          }}
          onMouseLeave={() => setHoverNav(null)}
          onClick={() => (openMenu === 'settings' ? closeAll() : openMenuNow('settings'))}
          onKeyDown={menuKeyHandler('settings')}
        >
          Settings
        </span>
      ) : null}

      {canSeeAdmin ? (
        <span
          ref={adminRef}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'admin'}
          style={styleFor('admin')}
          onMouseEnter={() => {
            setHoverNav('admin')
            openMenuNow('admin')
          }}
          onMouseLeave={() => setHoverNav(null)}
          onClick={() => (openMenu === 'admin' ? closeAll() : openMenuNow('admin'))}
          onKeyDown={menuKeyHandler('admin')}
        >
          Admin
        </span>
      ) : null}
    </nav>
  )
}

export function HeaderNavSkeleton({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        minHeight: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <div style={{ width: 72, height: 14 }} />
      <div style={{ width: 70, height: 14 }} />
      <div style={{ width: 52, height: 14 }} />
      <div style={{ width: 68, height: 14 }} />
    </div>
  )
}
