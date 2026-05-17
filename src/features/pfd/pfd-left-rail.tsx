import React from 'react'

import {
  PaletteButton,
  ThumbCircle,
  ThumbDecision,
  ThumbFrame,
  ThumbOperation,
  ThumbStartStop,
  ThumbSubProcess,
  ThumbTriangle,
} from './pfd-symbol-palette'
import {
  SURFACE_BG,
  SURFACE_BORDER,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  baseBtn,
  baseBtnDisabled,
} from './pfd-page-styles'

export function PfdLeftRail(props: {
  canStartEdit: boolean
  errorMessage: string
  hasProject: boolean
  hasNodes: boolean
  isEditOwner: boolean
  isLockedByOther: boolean
  isReadOnly: boolean
  lassoEnabled: boolean
  loading: boolean
  selectedIsOperation: boolean
  sessionBusy: boolean
  zoomPct: number
  onAddCircle: () => void
  onAddDecision: () => void
  onAddFrame: () => void
  onAddOperationAfterSelected: () => void
  onAddOperationAtEnd: () => void
  onAddProcessRef: () => void
  onAddStartStop: () => void
  onAddTriangle: () => void
  onCenterAll: () => void
  onDiscardDraft: () => void
  onOpenHistory: () => void
  onOpenSave: () => void
  onResequenceOperations: () => void
  onStartEditSession: () => void
  onToggleLasso: () => void
  onZoomStep: (direction: -1 | 1) => void
}) {
  const editButtonDisabled = props.sessionBusy || (!props.isEditOwner && (props.isLockedByOther || !props.canStartEdit))
  const disabledWhenReadOnly = props.isReadOnly ? baseBtnDisabled : null

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 30,
        top: 12,
        left: 12,
        width: 198,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        paddingRight: 2,
      }}
    >
      <div
        style={{
          padding: 10,
          borderRadius: SURFACE_RADIUS,
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${SURFACE_BORDER}`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className={`btn ${props.isEditOwner ? 'dangerBtn' : 'btnGreen'}`}
            style={{
              ...baseBtn,
              width: '100%',
              ...(editButtonDisabled ? baseBtnDisabled : null),
            }}
            onClick={props.isEditOwner ? props.onDiscardDraft : props.onStartEditSession}
            disabled={editButtonDisabled}
          >
            {props.sessionBusy ? 'Please wait...' : props.isEditOwner ? 'Discard draft' : 'Edit PFD'}
          </button>
          {props.isEditOwner ? (
            <button className="btn btnGreen" style={{ ...baseBtn, width: '100%' }} onClick={props.onOpenSave} disabled={!props.hasProject}>
              Save PFD
            </button>
          ) : null}
          <button className="btn btnGreen" style={{ ...baseBtn, width: '100%' }} onClick={props.onOpenHistory} disabled={!props.hasProject}>
            PFD history
          </button>
        </div>
        {props.errorMessage ? (
          <div style={{ fontSize: 12, padding: '8px 10px', borderRadius: SURFACE_RADIUS, background: 'rgba(127,29,29,0.42)', color: '#fee2e2', border: '1px solid rgba(248,113,113,0.4)' }}>
            <b>Error:</b> {props.errorMessage}
          </div>
        ) : null}
      </div>

      {props.isEditOwner && (
        <div
          style={{
            padding: 9,
            borderRadius: SURFACE_RADIUS,
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${SURFACE_BORDER}`,
            boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}
        >
          <PaletteButton title="Start/Stop" subtitle="Center" onClick={props.onAddStartStop} disabled={props.loading || !props.hasNodes || props.isReadOnly}><ThumbStartStop /></PaletteButton>
          <PaletteButton title="Process Step" subtitle="Adds at end" onClick={props.onAddOperationAtEnd} disabled={props.loading || props.isReadOnly}><ThumbOperation /></PaletteButton>
          <PaletteButton title="Process Step" subtitle="Insert after" onClick={props.onAddOperationAfterSelected} disabled={props.loading || !props.selectedIsOperation || props.isReadOnly}><ThumbOperation /></PaletteButton>
          <PaletteButton title="Decision" subtitle="Center" onClick={props.onAddDecision} disabled={props.loading || !props.hasNodes || props.isReadOnly}><ThumbDecision /></PaletteButton>
          <PaletteButton title="Connector" subtitle="Center" onClick={props.onAddCircle} disabled={props.loading || !props.hasNodes || props.isReadOnly}><ThumbCircle /></PaletteButton>
          <PaletteButton title="Storage" subtitle="Center" onClick={props.onAddTriangle} disabled={props.loading || !props.hasNodes || props.isReadOnly}><ThumbTriangle /></PaletteButton>
          <PaletteButton title="Frame" subtitle="Center" onClick={props.onAddFrame} disabled={props.loading || props.isReadOnly}><ThumbFrame /></PaletteButton>
          <PaletteButton title="Sub - Process" subtitle="Select process" onClick={props.onAddProcessRef} disabled={props.loading || props.isReadOnly}><ThumbSubProcess /></PaletteButton>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />
          <button className="btn btnGreen" style={{ ...baseBtn, width: '100%', ...disabledWhenReadOnly }} onClick={props.onResequenceOperations} disabled={props.isReadOnly}>
            Resequence
          </button>
          <button
            className="btn btnGreen"
            style={{
              ...baseBtn,
              width: '100%',
              ...disabledWhenReadOnly,
              ...(props.lassoEnabled ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' } : null),
            }}
            onClick={props.onToggleLasso}
            disabled={props.isReadOnly}
          >
            {props.lassoEnabled ? 'Lasso: ON' : 'Lasso: OFF'}
          </button>
        </div>
      )}

      <div
        style={{
          padding: 12,
          borderRadius: SURFACE_RADIUS,
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${SURFACE_BORDER}`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => props.onZoomStep(-1)}
            style={{ ...baseBtn, height: 29, width: 29, padding: 0, background: SURFACE_BG }}
            title="Zoom out"
          >
            -
          </button>
          <div
            style={{
              minWidth: 52,
              height: 29,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: SURFACE_TEXT,
              borderRadius: SURFACE_RADIUS,
              border: `1px solid ${SURFACE_BORDER}`,
              background: SURFACE_BG,
            }}
          >
            {props.zoomPct}%
          </div>
          <button
            type="button"
            onClick={() => props.onZoomStep(1)}
            style={{ ...baseBtn, height: 29, width: 29, padding: 0, background: SURFACE_BG }}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={props.onCenterAll}
            style={{ ...baseBtn, height: 29, padding: '0 10px', background: SURFACE_BG, flex: 1 }}
            title="Center all objects"
          >
            Center
          </button>
        </div>
      </div>
    </div>
  )
}
