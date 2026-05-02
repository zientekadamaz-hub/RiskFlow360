import Link from 'next/link'

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

type HeaderPublicActionsProps = {
  loginHref?: string
  onNavigate?: () => void
}

export function HeaderPublicActions({ loginHref = '/login', onNavigate }: HeaderPublicActionsProps) {
  return (
    <>
      <Link href="/signup" className="rf-button" style={headerButtonStyle} onClick={onNavigate}>
        Create account
      </Link>
      <Link href={loginHref} className="rf-button" style={headerButtonStyle} onClick={onNavigate}>
        Log in
      </Link>
    </>
  )
}
