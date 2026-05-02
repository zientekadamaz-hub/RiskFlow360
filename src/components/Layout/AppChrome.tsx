'use client'

import BrowserSessionGuard from '@/components/Auth/BrowserSessionGuard'
import IdleLogout from '@/components/Auth/IdleLogout'
import AppHeader from '@/components/Layout/AppHeader'

export default function AppChrome() {
  return (
    <>
      <BrowserSessionGuard />
      <AppHeader />
      <IdleLogout />
    </>
  )
}
