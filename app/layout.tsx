import './globals.css'
import AppHeader from '@/components/Layout/AppHeader'
import IdleLogout from '@/components/Auth/IdleLogout'
import BrowserSessionGuard from '@/components/Auth/BrowserSessionGuard'


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#f5f5f7', margin: 0 }}>
        <BrowserSessionGuard />
        <AppHeader />
        <IdleLogout />
        {children}
      </body>
    </html>
  )
}
