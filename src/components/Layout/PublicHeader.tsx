import { HeaderLogo } from './HeaderLogo'
import { HeaderPublicActions } from './HeaderPublicActions'

export default function PublicHeader() {
  const navHeight = 56
  const frameStyle: React.CSSProperties = { width: '80%', marginLeft: 'auto', marginRight: 'auto' }

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
        <HeaderLogo navHeight={navHeight} priority />

        <div aria-hidden />

        <nav style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }} aria-label="Public">
          <HeaderPublicActions loginHref="/login?next=%2Fprojects" />
        </nav>
      </div>
    </header>
  )
}
