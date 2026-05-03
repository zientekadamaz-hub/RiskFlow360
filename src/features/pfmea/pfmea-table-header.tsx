import React, { useState } from 'react'
import { createPortal } from 'react-dom'

const SURFACE_BORDER = 'rgba(255,255,255,0.16)'

export type PfmeaTableColumn = {
  id: string
}

type PfmeaTableHeaderProps = {
  isColumnVisible: (id: string) => boolean
  tableHeadRef: React.Ref<HTMLTableSectionElement>
  visibleColumnDefs: PfmeaTableColumn[]
  widthOf: (id: string) => string
}

function anchoredPopupStyle(anchorEl: HTMLElement | null, width: number, topGap = 0, maxHeight = 280): React.CSSProperties {
  if (typeof window === 'undefined' || !anchorEl) {
    return {
      position: 'fixed',
      top: 0,
      left: 0,
      width,
      maxHeight,
      visibility: 'hidden',
      pointerEvents: 'none',
    }
  }

  const rect = anchorEl.getBoundingClientRect()
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  const desiredHeight = Math.min(maxHeight, Math.max(160, window.innerHeight - 24))
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - topGap - 12)
  const spaceAbove = Math.max(0, rect.top - topGap - 12)
  const openAbove = spaceBelow < Math.min(desiredHeight, 220) && spaceAbove > spaceBelow
  const effectiveMaxHeight = Math.min(desiredHeight, Math.max(120, openAbove ? spaceAbove : spaceBelow))

  if (openAbove) {
    return {
      position: 'fixed',
      bottom: window.innerHeight - rect.top + topGap,
      left,
      width,
      maxHeight: effectiveMaxHeight,
    }
  }

  return {
    position: 'fixed',
    top: rect.bottom + topGap,
    left,
    width,
    maxHeight: effectiveMaxHeight,
  }
}

function Th(props: { w?: number | string; children?: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'center',
        padding: '10px 12px',
        fontSize: 13,
        color: 'rgba(255,255,255,0.78)',
        width: props.w,
        maxWidth: props.w,
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        borderRight: '1px solid rgba(255,255,255,0.14)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgb(40, 39, 47)',
        boxShadow: 'none',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        lineHeight: 1.2,
        fontWeight: 650,
      }}
    >
      {props.children}
    </th>
  )
}

function PcpHeaderHelp() {
  const [anchorEl, setAnchorEl] = useState<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <span
      ref={setAnchorEl}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative' }}
    >
      <span>PCP</span>
      <span
        aria-label="PCP rules"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 15,
          height: 15,
          borderRadius: '50%',
          border: '1px solid rgba(217,168,108,0.55)',
          color: '#d9a86c',
          fontSize: 10,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        ?
      </span>

      {open && anchorEl && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-pfmea-popup="true"
              style={{
                ...anchoredPopupStyle(anchorEl, 320, 0, 260),
                zIndex: 120,
                borderRadius: 10,
                border: `1px solid ${SURFACE_BORDER}`,
                background: 'rgb(52, 57, 69)',
                boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
                padding: 10,
                textAlign: 'left',
                position: 'fixed',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d9a86c', marginBottom: 6 }}>
                PCP selection rules
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {[
                  'A row is included in PCP when at least one of these rules is met:',
                  'CLASS = SC or CC',
                  'SEV is 9 or 10',
                  'RPN risk color is orange or red',
                  'A manual PCP selection overrides the automatic rule',
                ].map((line, idx) => (
                  <div key={`pcp-help-${idx}`} style={{ fontSize: 12, color: '#d9a86c', lineHeight: 1.35, fontWeight: 400 }}>
                    {idx === 0 ? line : `- ${line}`}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </span>
  )
}

function AfterHeader(props: { prefix: string }) {
  return (
    <>
      {props.prefix}{' '}
      <span style={{ fontSize: '0.78em', letterSpacing: 0.1 }}>(AFTER)</span>
    </>
  )
}

export function PfmeaTableHeader({
  isColumnVisible,
  tableHeadRef,
  visibleColumnDefs,
  widthOf,
}: PfmeaTableHeaderProps) {
  return (
    <>
      <colgroup>
        {visibleColumnDefs.map((col) => (
          <col key={col.id} style={{ width: widthOf(col.id) }} />
        ))}
      </colgroup>
      <thead ref={tableHeadRef}>
        <tr>
          {isColumnVisible('id') ? <Th w={widthOf('id')}>ID#</Th> : null}
          {isColumnVisible('station') ? <Th w={widthOf('station')}>STATION</Th> : null}
          {isColumnVisible('operation') ? <Th w={widthOf('operation')}>OPERATION</Th> : null}
          {isColumnVisible('process_step') ? <Th w={widthOf('process_step')}>PROCESS STEP</Th> : null}

          {isColumnVisible('failure_mode') ? <Th w={widthOf('failure_mode')}>FAILURE MODE</Th> : null}
          {isColumnVisible('characteristic') ? <Th w={widthOf('characteristic')}>CHARACTERISTIC</Th> : null}
          {isColumnVisible('class') ? <Th w={widthOf('class')}>CLASS</Th> : null}
          {isColumnVisible('effect') ? <Th w={widthOf('effect')}>EFFECT</Th> : null}
          {isColumnVisible('sev') ? <Th w={widthOf('sev')}>SEV</Th> : null}
          {isColumnVisible('cause') ? <Th w={widthOf('cause')}>CAUSE</Th> : null}
          {isColumnVisible('occ') ? <Th w={widthOf('occ')}>OCC</Th> : null}

          {isColumnVisible('current_prev') ? <Th w={widthOf('current_prev')}>CURRENT CONTROLS (PREV)</Th> : null}
          {isColumnVisible('current_det') ? <Th w={widthOf('current_det')}>CURRENT CONTROLS (DET)</Th> : null}
          {isColumnVisible('det') ? <Th w={widthOf('det')}>DET</Th> : null}

          {isColumnVisible('rpn') ? <Th w={widthOf('rpn')}>RPN</Th> : null}
          {isColumnVisible('pcp') ? <Th w={widthOf('pcp')}><PcpHeaderHelp /></Th> : null}

          {isColumnVisible('recommended_action') ? <Th w={widthOf('recommended_action')}>RECOMMENDED ACTION</Th> : null}
          {isColumnVisible('responsible') ? <Th w={widthOf('responsible')}>RESPONSIBLE</Th> : null}
          {isColumnVisible('target_date') ? <Th w={widthOf('target_date')}>TARGET DATE</Th> : null}
          {isColumnVisible('action_status') ? <Th w={widthOf('action_status')}>ACTION STATUS</Th> : null}

          {isColumnVisible('o2') ? <Th w={widthOf('o2')}><AfterHeader prefix="OCC" /></Th> : null}
          {isColumnVisible('d2') ? <Th w={widthOf('d2')}><AfterHeader prefix="DET" /></Th> : null}
          {isColumnVisible('rpn2') ? <Th w={widthOf('rpn2')}><AfterHeader prefix="RPN" /></Th> : null}

          {isColumnVisible('delete') ? <Th w={widthOf('delete')}></Th> : null}
        </tr>
      </thead>
    </>
  )
}
