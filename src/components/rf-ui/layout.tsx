import type { CSSProperties, ReactNode } from 'react'

import {
  settingsCardStyle,
  settingsFrameStyle,
  settingsHeroCardStyle,
  settingsPageStyle,
  settingsSharedOverlayBorder,
  settingsSubtitleStyle,
  settingsSurfaceRadius,
  settingsTitleStyle,
} from './tokens'

export function SettingsBackdrop() {
  return <SettingsBackdropTone />
}

export function SettingsBackdropTone({
  imageStyle,
  overlayStyle,
}: {
  imageStyle?: CSSProperties
  overlayStyle?: CSSProperties
}) {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/home-hero-bg.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          ...imageStyle,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(88, 58, 39, 0.58), rgba(23, 31, 51, 0.86))',
          ...overlayStyle,
        }}
      />
    </>
  )
}

export function SettingsPageShell({
  title,
  titleStyle,
  subtitle,
  actions,
  summary,
  summaryMaxWidth,
  children,
  backdrop,
}: {
  title: string
  titleStyle?: CSSProperties
  subtitle: ReactNode
  actions?: ReactNode
  summary?: ReactNode
  summaryMaxWidth?: number
  children: ReactNode
  backdrop?: ReactNode
}) {
  return (
    <div style={settingsPageStyle}>
      {backdrop ?? <SettingsBackdrop />}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ ...settingsFrameStyle, marginTop: 20 }}>
          <div style={{ ...settingsHeroCardStyle, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 320px', maxWidth: 560 }}>
                <div style={{ ...settingsTitleStyle, ...titleStyle }}>{title}</div>
                <div style={settingsSubtitleStyle}>{subtitle}</div>
                {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{actions}</div> : null}
              </div>
              {summary ? (
                <div style={{ width: '100%', maxWidth: summaryMaxWidth ?? 920, marginLeft: 'auto', alignSelf: 'flex-start' }}>{summary}</div>
              ) : null}
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}

export function SettingsSection({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ ...settingsFrameStyle, marginTop: 12 }}>
      <div style={{ ...settingsCardStyle, ...style }}>{children}</div>
    </div>
  )
}

export function SettingsBanner({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'neutral'
  children: ReactNode
}) {
  if (tone === 'success' || tone === 'error') {
    return (
      <div style={{ ...settingsFrameStyle, marginTop: 8 }}>
        <div
          role={tone === 'error' ? 'alert' : 'status'}
          style={{
            color: tone === 'error' ? '#fecaca' : '#bbf7d0',
            fontSize: 12.5,
            fontWeight: 650,
            lineHeight: 1.35,
            padding: '0 2px',
          }}
        >
          {children}
        </div>
      </div>
    )
  }

  const neutralStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    color: '#f8fafc',
    borderColor: settingsSharedOverlayBorder,
  }

  return (
    <div style={{ ...settingsFrameStyle, marginTop: 12 }}>
      <div
        style={{
          fontSize: 12,
          padding: '10px 12px',
          borderRadius: settingsSurfaceRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          ...neutralStyle,
        }}
      >
        {children}
      </div>
    </div>
  )
}
