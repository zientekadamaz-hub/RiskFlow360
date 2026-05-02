import './globals.css'
import AppChrome from '@/components/Layout/AppChrome'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body style={{ background: '#f5f5f7', margin: 0 }}>
        <AppChrome />
        {children}
      </body>
    </html>
  )
}
