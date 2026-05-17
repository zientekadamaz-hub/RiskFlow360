import Link from 'next/link'
import React from 'react'

import { SURFACE_BORDER, SURFACE_RADIUS, baseBtn } from './pfd-page-styles'

export function PfdRightNav(props: { projectId: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: 12,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${SURFACE_BORDER}`,
          borderRadius: SURFACE_RADIUS,
          padding: 10,
          boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Link
          href={`/pfmea?project=${props.projectId}`}
          className="btn btnGreen"
          style={{ ...baseBtn, width: 180 }}
        >
          PFMEA
        </Link>
        <Link
          href={`/pcp?project=${props.projectId}`}
          className="btn btnGreen"
          style={{ ...baseBtn, width: 180 }}
        >
          PCP
        </Link>
      </div>
    </div>
  )
}
