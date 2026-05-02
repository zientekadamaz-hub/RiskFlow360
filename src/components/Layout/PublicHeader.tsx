import Image from 'next/image'
import Link from 'next/link'

export default function PublicHeader() {
  const navHeight = 56
  const frameStyle: React.CSSProperties = { width: '80%', marginLeft: 'auto', marginRight: 'auto' }
  const headerButtonStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 650,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid #ddd',
    background: '#fff',
    color: '#111',
    textDecoration: 'none',
    textAlign: 'center',
  }

  return (
    <header
      style={{
        background: '#fff',
        height: navHeight,
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 60,
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          ...frameStyle,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', height: navHeight, textDecoration: 'none' }}
          aria-label="RiskFlow 360"
        >
          <Image
            src="/logo-riskflow-360.png"
            alt="RiskFlow 360"
            width={250}
            height={56}
            priority
            style={{
              height: 56,
              width: 'auto',
              maxWidth: 250,
              display: 'block',
              objectFit: 'contain',
            }}
          />
        </Link>

        <div aria-hidden />

        <nav style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }} aria-label="Public">
          <Link href="/signup" className="rf-button" style={headerButtonStyle}>
            Create account
          </Link>
          <Link href="/login?next=%2Fprojects" className="rf-button" style={headerButtonStyle}>
            Log in
          </Link>
        </nav>
      </div>
    </header>
  )
}
