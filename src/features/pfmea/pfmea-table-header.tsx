import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SettingsTableColumnHeader,
  type SettingsColumnMenuItem,
} from '@/features/settings/column-menu'
import { anchoredPopupStyle } from './pfmea-popup-position'

const SURFACE_BORDER = 'rgba(255,255,255,0.16)'

export type PfmeaTableColumn = {
  id: string
}

type PfmeaTableHeaderProps = {
  isColumnVisible: (id: string) => boolean
  onHideColumn?: (id: string) => void
  tableHeadRef: React.Ref<HTMLTableSectionElement>
  visibleColumnDefs: PfmeaTableColumn[]
  widthOf: (id: string) => string
}

function HideColumnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Th(props: {
  columnId?: string
  label?: React.ReactNode
  onHideColumn?: (id: string) => void
  w?: number | string
  children?: React.ReactNode
}) {
  const menuItems: SettingsColumnMenuItem[] =
    props.columnId && props.onHideColumn
      ? [
          {
            icon: <HideColumnIcon />,
            key: 'hide',
            label: 'Hide column',
            onSelect: () => props.onHideColumn?.(props.columnId!),
          },
        ]
      : []

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
      {props.label != null ? (
        <SettingsTableColumnHeader
          label={props.label}
          menuItems={menuItems}
          menuTitle={`${typeof props.label === 'string' ? props.label : 'Column'} actions`}
        />
      ) : (
        props.children
      )}
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
  onHideColumn,
  tableHeadRef,
  visibleColumnDefs,
  widthOf,
}: PfmeaTableHeaderProps) {
  const renderTh = (id: string, label: React.ReactNode) => (
    <Th columnId={id} label={label} onHideColumn={id === 'delete' ? undefined : onHideColumn} w={widthOf(id)} />
  )

  return (
    <>
      <colgroup>
        {visibleColumnDefs.map((col) => (
          <col key={col.id} style={{ width: widthOf(col.id) }} />
        ))}
      </colgroup>
      <thead ref={tableHeadRef}>
        <tr>
          {isColumnVisible('id') ? renderTh('id', 'ID#') : null}
          {isColumnVisible('station') ? renderTh('station', 'STATION') : null}
          {isColumnVisible('operation') ? renderTh('operation', 'OPERATION') : null}
          {isColumnVisible('process_step') ? renderTh('process_step', 'PROCESS STEP') : null}

          {isColumnVisible('failure_mode') ? renderTh('failure_mode', 'FAILURE MODE') : null}
          {isColumnVisible('characteristic') ? renderTh('characteristic', 'CHARACTERISTIC') : null}
          {isColumnVisible('class') ? renderTh('class', 'CLASS') : null}
          {isColumnVisible('effect') ? renderTh('effect', 'EFFECT') : null}
          {isColumnVisible('sev') ? renderTh('sev', 'SEV') : null}
          {isColumnVisible('cause') ? renderTh('cause', 'CAUSE') : null}
          {isColumnVisible('occ') ? renderTh('occ', 'OCC') : null}

          {isColumnVisible('current_prev') ? renderTh('current_prev', 'CURRENT CONTROLS (PREV)') : null}
          {isColumnVisible('current_det') ? renderTh('current_det', 'CURRENT CONTROLS (DET)') : null}
          {isColumnVisible('det') ? renderTh('det', 'DET') : null}

          {isColumnVisible('rpn') ? renderTh('rpn', 'RPN') : null}
          {isColumnVisible('pcp') ? renderTh('pcp', <PcpHeaderHelp />) : null}

          {isColumnVisible('recommended_action') ? renderTh('recommended_action', 'RECOMMENDED ACTION') : null}
          {isColumnVisible('responsible') ? renderTh('responsible', 'RESPONSIBLE') : null}
          {isColumnVisible('target_date') ? renderTh('target_date', 'TARGET DATE') : null}
          {isColumnVisible('action_status') ? renderTh('action_status', 'ACTION STATUS') : null}

          {isColumnVisible('o2') ? renderTh('o2', <AfterHeader prefix="OCC" />) : null}
          {isColumnVisible('d2') ? renderTh('d2', <AfterHeader prefix="DET" />) : null}
          {isColumnVisible('rpn2') ? renderTh('rpn2', <AfterHeader prefix="RPN" />) : null}

          {isColumnVisible('delete') ? <Th w={widthOf('delete')}></Th> : null}
        </tr>
      </thead>
    </>
  )
}
