import Image from 'next/image'
import Link from 'next/link'
import { buildHeaderAssetPath } from './app-header-model'

type HeaderLogoProps = {
  basePath?: string
  navHeight?: number
  onClick?: () => void
  priority?: boolean
}

export function HeaderLogo({ basePath = '', navHeight = 56, onClick, priority = false }: HeaderLogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', height: navHeight, textDecoration: 'none' }}
      aria-label="RiskFlow 360"
      title="RiskFlow 360"
    >
      <Image
        src={buildHeaderAssetPath('/logo-riskflow-360.png', basePath)}
        alt="RiskFlow 360"
        width={250}
        height={56}
        priority={priority}
        style={{
          height: 56,
          width: 'auto',
          maxWidth: 250,
          display: 'block',
          objectFit: 'contain',
        }}
      />
    </Link>
  )
}
