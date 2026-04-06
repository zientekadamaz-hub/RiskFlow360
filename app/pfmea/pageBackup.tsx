// @ts-nocheck
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'

type Project = { id: string; name: string }

type Operation = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine: string | null
  operation: string | null
  active?: boolean
}

type PfmeaRow = {
  id: string
  operation_id: string

  failure_mode: string
  effect: string
  severity: number | null
  class: string | null
  cause: string
  occurrence: number | null
  current_prevention: string
  current_detection: string
  detection: number | null

  rpn: number | null
  oxd: number | null

  recommended_action: string
  responsible: string
  target_date: string | null
  action_status: string | null

  occurrence2: number | null
  detection2: number | null

  rpn2: number | null
  oxd2: number | null

  rpn_current: number | null
  oxd_current: number | null

  created_at: string

  operations?: {
    id: string
    operation_number: number | null
    name: string
    machine: string | null
    operation: string | null
    project_id: string
    active?: boolean
  } | null
}

type NewRowDraft = { operation_id: string }
type RiskCode = 'G' | 'Y' | 'O' | 'R'

function getNextOpNo(existing: (number | null)[]) {
  const nums = existing.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  if (nums.length === 0) return 10
  return Math.max(...nums) + 10
}

function toInt_1_10_orNull(v: string): number | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (!/^\d{1,2}$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  if (i < 1 || i > 10) return null
  return i
}

function isInt1to10(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 10
}

function safeMul(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  const x = a * b
  if (!Number.isFinite(x)) return null
  return Math.trunc(x)
}

function safeRpn(sev: number | null, oxd: number | null): number | null {
  if (sev == null || oxd == null) return null
  const x = sev * oxd
  if (!Number.isFinite(x)) return null
  return Math.trunc(x)
}

/** 1:1 Excel: kolor zależny od Severity i (Occ*Det) */
function riskCodeFromSevAndOxd(sev: number | null, oxd: number | null): RiskCode {
  if (!sev || !oxd) return 'G'

  if (sev === 10) return oxd >= 38 ? 'R' : oxd >= 12 ? 'O' : oxd >= 5 ? 'Y' : 'G'
  if (sev === 9) return oxd >= 40 ? 'R' : oxd >= 14 ? 'O' : oxd >= 5 ? 'Y' : 'G'
  if (sev === 8) return oxd >= 45 ? 'R' : oxd >= 15 ? 'O' : oxd >= 12 ? 'Y' : 'G'
  if (sev === 7) return oxd >= 54 ? 'R' : oxd >= 16 ? 'O' : oxd >= 14 ? 'Y' : 'G'
  if (sev === 6) return oxd >= 20 ? 'O' : oxd >= 15 ? 'Y' : 'G'
  if (sev === 5) return oxd >= 24 ? 'O' : oxd >= 18 ? 'Y' : 'G'
  if (sev === 4) return oxd >= 32 ? 'O' : oxd >= 25 ? 'Y' : 'G'
  if (sev === 3) return oxd >= 38 ? 'O' : oxd >= 28 ? 'Y' : 'G'
  if (sev === 2) return oxd >= 54 ? 'O' : oxd >= 45 ? 'Y' : 'G'
  if (sev === 1) return oxd >= 100 ? 'Y' : 'G'

  return 'G'
}

/** Tło 15% */
function riskBgStyle(code: RiskCode): React.CSSProperties {
  if (code === 'R') return { background: 'rgba(239, 68, 68, 0.15)' }
  if (code === 'O') return { background: 'rgba(249, 115, 22, 0.15)' }
  if (code === 'Y') return { background: 'rgba(234, 179, 8, 0.15)' }
  return { background: 'rgba(34, 197, 94, 0.15)' }
}

function computeDerived(row: PfmeaRow): Pick<PfmeaRow, 'rpn' | 'oxd' | 'rpn2' | 'oxd2' | 'rpn_current' | 'oxd_current'> {
  const sev = isInt1to10(row.severity) ? row.severity : null
  const occ = isInt1to10(row.occurrence) ? row.occurrence : null
  const det = isInt1to10(row.detection) ? row.detection : null

  const oxd = safeMul(occ, det)
  const rpn = safeRpn(sev, oxd)

  const occ2 = isInt1to10(row.occurrence2) ? row.occurrence2 : null
  const det2 = isInt1to10(row.detection2) ? row.detection2 : null

  const oxd2 = safeMul(occ2, det2)
  const rpn2 = safeRpn(sev, oxd2)

  const isClosed = (row.action_status ?? '').toUpperCase() === 'CLOSED'
  const rpn_current = isClosed ? rpn2 : rpn
  const oxd_current = isClosed ? oxd2 : oxd

  return { rpn, oxd, rpn2, oxd2, rpn_current, oxd_current }
}

export default function PfmeaFullPage() {
  const sp = useSearchParams()
  const projectId = sp.get('project') ?? ''
  const opFromUrl = sp.get('op') ?? ''

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [project, setProject] = useState<Project | null>(null)
  const [ops, setOps] = useState<Operation[]>([])
  const [rows, setRows] = useState<PfmeaRow[]>([])

  const [draft, setDraft] = useState<NewRowDraft>({ operation_id: '' })

  const [edit, setEdit] = useState<{ rowId: string; col: keyof PfmeaRow } | null>(null)
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null)

  const canWork = !!projectId
  const canAdd = useMemo(() => canWork && !!draft.operation_id && ops.length > 0, [canWork, draft.operation_id, ops.length])

  async function loadAll() {
    if (!projectId) return
    setLoading(true)
    setErr('')

    const pr = await supabase.from('projects').select('id,name').eq('id', projectId).maybeSingle()
    if (pr.error) {
      setErr(pr.error.message)
      setLoading(false)
      return
    }
    setProject((pr.data ?? null) as any)

    // operations only active
    const opsRes = await supabase
      .from('operations')
      .select('id,project_id,operation_number,name,machine,operation,active')
      .eq('project_id', projectId)
      .eq('active', true)
      .order('operation_number', { ascending: true })

    if (opsRes.error) {
      setErr(opsRes.error.message)
      setLoading(false)
      return
    }

    const operations = (opsRes.data ?? []) as Operation[]
    setOps(operations)

    // PFMEA rows joined to active operations
    const pfmeaRes = await supabase
      .from('pfmea_rows')
      .select(
        [
          'id',
          'operation_id',
          'failure_mode',
          'effect',
          'severity',
          'class',
          'cause',
          'occurrence',
          'current_prevention',
          'current_detection',
          'detection',
          'rpn',
          'oxd',
          'recommended_action',
          'responsible',
          'target_date',
          'action_status',
          'occurrence2',
          'detection2',
          'rpn2',
          'oxd2',
          'rpn_current',
          'oxd_current',
          'created_at',
          'operations!inner(id,operation_number,name,machine,operation,project_id,active)',
        ].join(',')
      )
      .eq('operations.project_id', projectId)
      .eq('operations.active', true)
      .order('operation_number', { foreignTable: 'operations', ascending: true })
      .order('created_at', { ascending: true })

    if (pfmeaRes.error) {
      setErr(pfmeaRes.error.message)
      setLoading(false)
      return
    }

    setRows((pfmeaRes.data ?? []) as unknown as PfmeaRow[])
    setLoading(false)

    // default selection: URL op > first op
    if (opFromUrl) {
      const exists = operations.some((o) => o.id === opFromUrl)
      if (exists) {
        setDraft({ operation_id: opFromUrl })
        return
      }
    }

    if (!draft.operation_id && operations.length > 0) {
      setDraft({ operation_id: operations[0].id })
    }
  }

  useEffect(() => {
    if (!projectId) return
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (!opFromUrl) return
    setDraft({ operation_id: opFromUrl })
  }, [opFromUrl])

  useEffect(() => {
    if (!edit) return
    setTimeout(() => editorRef.current?.focus?.(), 0)
  }, [edit])

  const createFirstOperation = useCallback(async () => {
    if (!projectId) {
      setErr('Brak projectId w URL. Otwórz PFMEA z listy projektów (link ma /pfmea?project=...).')
      return
    }
    setErr('')

    const res = await supabase
      .from('operations')
      .insert([{ project_id: projectId, operation_number: 10, name: '', machine: '', operation: '', active: true }])
      .select('id')
      .single()

    if (res.error) {
      setErr(res.error.message)
      return
    }

    await loadAll()
    if (res.data?.id) setDraft({ operation_id: res.data.id })
  }, [projectId])

  const createNextOperation = useCallback(async () => {
    if (!projectId) {
      setErr('Brak projectId w URL. Otwórz PFMEA z listy projektów (link ma /pfmea?project=...).')
      return
    }
    setErr('')

    const nextNo = getNextOpNo(ops.map((o) => o.operation_number))
    const last = [...ops]
      .filter((o) => typeof o.operation_number === 'number')
      .sort((a, b) => (a.operation_number ?? 0) - (b.operation_number ?? 0))
      .at(-1)

    const res = await supabase
      .from('operations')
      .insert([
        {
          project_id: projectId,
          operation_number: nextNo,
          name: '',
          machine: last?.machine ?? '',
          operation: last?.operation ?? '',
          active: true,
        },
      ])
      .select('id')
      .single()

    if (res.error) {
      setErr(res.error.message)
      return
    }

    await loadAll()
    if (res.data?.id) setDraft({ operation_id: res.data.id })
  }, [projectId, ops])

  async function addRow() {
    if (!canAdd) return
    setErr('')

    const payload: Partial<PfmeaRow> & { operation_id: string } = {
      operation_id: draft.operation_id,

      failure_mode: '',
      effect: '',
      severity: null,
      class: null,
      cause: '',
      occurrence: null,
      current_prevention: '',
      current_detection: '',
      detection: null,

      rpn: null,
      oxd: null,

      recommended_action: '',
      responsible: '',
      target_date: null,
      action_status: null,

      occurrence2: null,
      detection2: null,

      rpn2: null,
      oxd2: null,

      rpn_current: null,
      oxd_current: null,
    }

    const res = await supabase.from('pfmea_rows').insert([payload])
    if (res.error) {
      setErr(res.error.message)
      return
    }
    await loadAll()
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this PFMEA row?')) return
    setErr('')
    const res = await supabase.from('pfmea_rows').delete().eq('id', id)
    if (res.error) setErr(res.error.message)
    await loadAll()
  }

  /** Update + zawsze przelicz i zapisz pochodne pola do bazy (bez NaN/undefined) */
  async function updateCellWithDerived(row: PfmeaRow, patch: Partial<PfmeaRow>) {
    setErr('')

    const guarded: Partial<PfmeaRow> = { ...patch }
    ;(['severity', 'occurrence', 'detection', 'occurrence2', 'detection2'] as (keyof PfmeaRow)[]).forEach((k) => {
      if (k in guarded) {
        const v = (guarded as any)[k]
        if (v === null) return
        if (!isInt1to10(v)) (guarded as any)[k] = null
      }
    })

    const merged: PfmeaRow = { ...row, ...(guarded as any) }
    const derived = computeDerived(merged)

    const res = await supabase.from('pfmea_rows').update({ ...guarded, ...derived }).eq('id', row.id)

    if (res.error) {
      setErr(res.error.message)
      return
    }
    await loadAll()
  }

  const rowsSorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const ao = a.operations?.operation_number ?? 0
      const bo = b.operations?.operation_number ?? 0
      if (ao !== bo) return ao - bo
      return String(a.created_at).localeCompare(String(b.created_at))
    })
    return copy
  }, [rows])

  const rowsSortedMemo = useRef<PfmeaRow[]>([])
  useEffect(() => {
    rowsSortedMemo.current = rowsSorted
  }, [rowsSorted])

  const colOrder = useMemo<(keyof PfmeaRow)[]>(
    () => [
      'failure_mode',
      'effect',
      'severity',
      'class',
      'cause',
      'occurrence',
      'current_prevention',
      'current_detection',
      'detection',
      'recommended_action',
      'responsible',
      'target_date',
      'action_status',
      'occurrence2',
      'detection2',
    ],
    []
  )

  function nextCell(rowIndex: number, colIdx: number) {
    let c = colIdx + 1
    let r = rowIndex
    if (c >= colOrder.length) {
      c = 0
      r = Math.min(rowIndex + 1, rowsSortedMemo.current.length - 1)
    }
    return { r, c }
  }
  function prevCell(rowIndex: number, colIdx: number) {
    let c = colIdx - 1
    let r = rowIndex
    if (c < 0) {
      c = colOrder.length - 1
      r = Math.max(rowIndex - 1, 0)
    }
    return { r, c }
  }

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<any>, rowIndex: number, colIdx: number, allowEnterNewline: boolean) => {
      if (e.key === 'Enter' && allowEnterNewline) return

      if (e.key === 'Tab') {
        e.preventDefault()
        const pos = e.shiftKey ? prevCell(rowIndex, colIdx) : nextCell(rowIndex, colIdx)
        const nextRow = rowsSortedMemo.current[pos.r]
        if (!nextRow) return
        setEdit({ rowId: nextRow.id, col: colOrder[pos.c] })
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setEdit(null)
        return
      }
    },
    [colOrder]
  )

  if (!projectId) {
    return (
      <div style={{ padding: 18, fontFamily: 'system-ui, Segoe UI, Arial' }}>
        <Link href="/projects" style={{ textDecoration: 'none' }}>
          ← Back to projects
        </Link>
        <h1 style={{ margin: '10px 0 4px' }}>PFMEA (Full Project)</h1>
        <div style={{ color: 'crimson', marginTop: 10, fontWeight: 800 }}>Missing project id in URL.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 18, fontFamily: 'system-ui, Segoe UI, Arial' }}>
      <style jsx global>{`
        .pfmeaTable .pfmeaEditor,
        .pfmeaTable .pfmeaEditor:focus {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          width: 100% !important;
          font: inherit !important;
          color: inherit !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .pfmeaTable textarea.pfmeaEditor {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          resize: none !important;
          overflow: hidden !important;
          min-height: 18px !important;
        }

        .pfmeaTable input.pfmeaEditor[type='date'] {
          -webkit-appearance: none !important;
          appearance: none !important;
        }

        .pfmeaTable select.pfmeaEditor {
          -webkit-appearance: none !important;
          appearance: none !important;
        }

        /* cieńsza czcionka */
        .pfmeaTd {
          padding: 10px 10px !important;
          vertical-align: top;
          background: #fff;
          color: rgba(0, 0, 0, 0.82);
          overflow: hidden;
          position: relative;
          font-weight: 500;
          font-size: 12px;
          line-height: 1.25;
          border: 0 !important;
        }

        /* podział wierszy */
        .pfmeaRow:not(:last-child) .pfmeaTd {
          border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
        }

        /* podział kolumn */
        .pfmeaTd {
          border-right: 1px solid rgba(0, 0, 0, 0.08) !important;
        }
        .pfmeaRow .pfmeaTd:last-child {
          border-right: 0 !important;
        }

        /* podwójna cienka linia między grupami operacji */
        .pfmeaRow.groupStart .pfmeaTd {
          border-top: 3px double rgba(0, 0, 0, 0.18) !important;
        }

        .pfmeaTd.editable:hover {
          box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
        }
        .pfmeaTd.editable:focus-within {
          box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.25);
          border-radius: 8px;
        }

        .pfmeaTd.gray {
          background: rgba(0, 0, 0, 0.03);
          color: rgba(0, 0, 0, 0.65);
        }

        .pfmeaTd.center {
          text-align: center;
        }

        .pfmeaTd.singleLine {
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .pfmeaTd.multiLine {
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .trashBtn {
          height: 32px;
          width: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: white;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
        }
        .trashBtn:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.4);
        }
        .trashBtn:active {
          transform: translateY(1px);
        }
        .trashIcon {
          width: 16px;
          height: 16px;
          color: rgba(0, 0, 0, 0.65);
        }
        .trashBtn:hover .trashIcon {
          color: rgba(239, 68, 68, 0.95);
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div>
          <Link href="/projects" style={{ textDecoration: 'none' }}>
            ← Back to projects
          </Link>
          <h1 style={{ margin: '10px 0 4px' }}>PFMEA (Full Project)</h1>
          <div style={{ color: '#666', fontSize: 12 }}>
            Project: <b>{project?.name ?? projectId}</b>
          </div>
        </div>

        <Link href={`/pfd?project=${projectId}`} style={pillLink}>
          Open PFD →
        </Link>
      </div>

      <div style={{ minHeight: 26, marginTop: 10 }}>
        {err && <div style={{ color: 'crimson' }}>{err}</div>}
        {loading && <div>Loading…</div>}
      </div>

      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Add PFMEA row</div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ops.length === 0 ? (
              <button onClick={createFirstOperation} style={pillBtn}>
                + Create first operation (OP 10)
              </button>
            ) : (
              <button onClick={createNextOperation} style={pillBtn}>
                + Create next operation (OP {getNextOpNo(ops.map((o) => o.operation_number))})
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '560px 140px 1fr', gap: 10, alignItems: 'end', marginTop: 10 }}>
          <div>
            <div style={lbl}>Operation / Step (ID#)</div>
            <select
              value={draft.operation_id}
              onChange={(e) => setDraft({ operation_id: e.target.value })}
              style={input}
              disabled={ops.length === 0}
            >
              {ops.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.operation_number ?? ''} — {o.name || ''} | Station: {o.machine ?? ''} | Operation: {o.operation ?? ''}
                </option>
              ))}
            </select>
          </div>

          <button onClick={addRow} disabled={!canAdd} style={{ ...pillBtn, height: 40, opacity: canAdd ? 1 : 0.5 }}>
            + Add row
          </button>

          <div style={{ color: '#666', fontSize: 12, lineHeight: 1.35 }}>
            Klik w komórkę = edycja. Auto-save na blur. Tab/Shift+Tab = nawigacja.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, width: '100%' }}>
        <div style={{ border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
          <div
            className="pfmeaTable"
            style={{
              maxHeight: 'calc(100vh - 320px)',
              overflow: 'auto',
              background: 'white',
            }}
          >
            <table style={{ width: 1220, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', fontSize: 12, background: 'white' }}>
              <thead>
                <tr>
                  <Th w={55}>ID#</Th>
                  <Th w={120}>STATION</Th>
                  <Th w={120}>OPERATION</Th>
                  <Th w={150}>PROCESS STEP</Th>

                  <Th w={150}>FAILURE MODE</Th>
                  <Th w={150}>EFFECT(S)</Th>
                  <Th w={52}>SEV</Th>
                  <Th w={60}>CLASS</Th>
                  <Th w={150}>CAUSE(S)</Th>
                  <Th w={52}>OCC</Th>

                  <Th w={165}>CURRENT CONTROLS (PREV)</Th>
                  <Th w={165}>CURRENT CONTROLS (DET)</Th>
                  <Th w={52}>DET</Th>

                  <Th w={60}>RPN</Th>

                  <Th w={170}>RECOMMENDED ACTION</Th>
                  <Th w={120}>RESPONSIBLE</Th>
                  <Th w={120}>TARGET DATE</Th>
                  <Th w={120}>ACTION STATUS</Th>

                  <Th w={52}>O2</Th>
                  <Th w={52}>D2</Th>
                  <Th w={65}>RPN2</Th>

                  <Th w={55}></Th>
                </tr>
              </thead>

              <tbody>
                {rowsSorted.map((r, rowIndex) => {
                  const opNo = r.operations?.operation_number ?? null
                  const station = r.operations?.machine ?? ''
                  const operationName = r.operations?.operation ?? ''
                  const step = r.operations?.name ?? ''

                  const sev = isInt1to10(r.severity) ? r.severity : null
                  const occ = isInt1to10(r.occurrence) ? r.occurrence : null
                  const det = isInt1to10(r.detection) ? r.detection : null
                  const oxd = safeMul(occ, det)
                  const rpn = safeRpn(sev, oxd)

                  const occ2 = isInt1to10(r.occurrence2) ? r.occurrence2 : null
                  const det2 = isInt1to10(r.detection2) ? r.detection2 : null
                  const oxd2 = safeMul(occ2, det2)
                  const rpn2 = safeRpn(sev, oxd2)

                  const riskRpn = riskBgStyle(riskCodeFromSevAndOxd(sev, oxd))
                  const riskRpn2 = riskBgStyle(riskCodeFromSevAndOxd(sev, oxd2))

                  const prevOpNo = rowIndex > 0 ? rowsSorted[rowIndex - 1]?.operations?.operation_number ?? null : null
                  const groupStart = rowIndex > 0 && opNo != null && prevOpNo != null && opNo !== prevOpNo

                  return (
                    <tr key={r.id} className={`pfmeaRow ${groupStart ? 'groupStart' : ''}`}>
                      <TdRead value={opNo == null ? '' : String(opNo)} center gray multiLine />
                      <TdRead value={station} gray multiLine />
                      <TdRead value={operationName} gray multiLine />
                      <TdRead value={step} gray multiLine />

                      <TdText
                        value={r.failure_mode}
                        editing={edit?.rowId === r.id && edit?.col === 'failure_mode'}
                        onStart={() => setEdit({ rowId: r.id, col: 'failure_mode' })}
                        onCommit={(v) => updateCellWithDerived(r, { failure_mode: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('failure_mode'), true)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdText
                        value={r.effect}
                        editing={edit?.rowId === r.id && edit?.col === 'effect'}
                        onStart={() => setEdit({ rowId: r.id, col: 'effect' })}
                        onCommit={(v) => updateCellWithDerived(r, { effect: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('effect'), true)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdNum
                        value={r.severity}
                        editing={edit?.rowId === r.id && edit?.col === 'severity'}
                        onStart={() => setEdit({ rowId: r.id, col: 'severity' })}
                        onCommit={(n) => updateCellWithDerived(r, { severity: n })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('severity'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdText
                        value={r.class ?? ''}
                        editing={edit?.rowId === r.id && edit?.col === 'class'}
                        onStart={() => setEdit({ rowId: r.id, col: 'class' })}
                        onCommit={(v) => updateCellWithDerived(r, { class: v || null })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('class'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                        singleLine
                      />

                      <TdText
                        value={r.cause}
                        editing={edit?.rowId === r.id && edit?.col === 'cause'}
                        onStart={() => setEdit({ rowId: r.id, col: 'cause' })}
                        onCommit={(v) => updateCellWithDerived(r, { cause: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('cause'), true)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdNum
                        value={r.occurrence}
                        editing={edit?.rowId === r.id && edit?.col === 'occurrence'}
                        onStart={() => setEdit({ rowId: r.id, col: 'occurrence' })}
                        onCommit={(n) => updateCellWithDerived(r, { occurrence: n })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('occurrence'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdText
                        value={r.current_prevention}
                        editing={edit?.rowId === r.id && edit?.col === 'current_prevention'}
                        onStart={() => setEdit({ rowId: r.id, col: 'current_prevention' })}
                        onCommit={(v) => updateCellWithDerived(r, { current_prevention: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('current_prevention'), true)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdText
                        value={r.current_detection}
                        editing={edit?.rowId === r.id && edit?.col === 'current_detection'}
                        onStart={() => setEdit({ rowId: r.id, col: 'current_detection' })}
                        onCommit={(v) => updateCellWithDerived(r, { current_detection: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('current_detection'), true)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdNum
                        value={r.detection}
                        editing={edit?.rowId === r.id && edit?.col === 'detection'}
                        onStart={() => setEdit({ rowId: r.id, col: 'detection' })}
                        onCommit={(n) => updateCellWithDerived(r, { detection: n })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('detection'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdRead value={rpn == null ? '' : String(rpn)} center gray singleLine style={riskRpn} />

                      <TdText
                        value={r.recommended_action}
                        editing={edit?.rowId === r.id && edit?.col === 'recommended_action'}
                        onStart={() => setEdit({ rowId: r.id, col: 'recommended_action' })}
                        onCommit={(v) => updateCellWithDerived(r, { recommended_action: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('recommended_action'), true)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdText
                        value={r.responsible}
                        editing={edit?.rowId === r.id && edit?.col === 'responsible'}
                        onStart={() => setEdit({ rowId: r.id, col: 'responsible' })}
                        onCommit={(v) => updateCellWithDerived(r, { responsible: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('responsible'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                        singleLine
                      />

                      <TdDate
                        value={r.target_date}
                        editing={edit?.rowId === r.id && edit?.col === 'target_date'}
                        onStart={() => setEdit({ rowId: r.id, col: 'target_date' })}
                        onCommit={(v) => updateCellWithDerived(r, { target_date: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('target_date'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdSelect
                        value={r.action_status}
                        editing={edit?.rowId === r.id && edit?.col === 'action_status'}
                        onStart={() => setEdit({ rowId: r.id, col: 'action_status' })}
                        onCommit={(v) => updateCellWithDerived(r, { action_status: v })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('action_status'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                        options={['OPEN', 'CLOSED']}
                      />

                      <TdNum
                        value={r.occurrence2}
                        editing={edit?.rowId === r.id && edit?.col === 'occurrence2'}
                        onStart={() => setEdit({ rowId: r.id, col: 'occurrence2' })}
                        onCommit={(n) => updateCellWithDerived(r, { occurrence2: n })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('occurrence2'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdNum
                        value={r.detection2}
                        editing={edit?.rowId === r.id && edit?.col === 'detection2'}
                        onStart={() => setEdit({ rowId: r.id, col: 'detection2' })}
                        onCommit={(n) => updateCellWithDerived(r, { detection2: n })}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colOrder.indexOf('detection2'), false)}
                        editorRef={editorRef}
                        stopEdit={() => setEdit(null)}
                      />

                      <TdRead value={rpn2 == null ? '' : String(rpn2)} center gray singleLine style={riskRpn2} />

                      <td className="pfmeaTd center" style={{ padding: '10px 8px !important' }}>
                        <button className="trashBtn" onClick={() => deleteRow(r.id)} aria-label="Delete row" title="Delete">
                          <svg className="trashIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M9 3h6m-8 4h10m-9 0 1 15h6l1-15M10 7v13m4-13v13"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 10, color: '#888', fontSize: 12 }}>DEV MODE: RLS off.</div>
      </div>
    </div>
  )
}

/** ===== sticky TH ===== */
function Th(props: { w: number; children?: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '10px 10px',
        fontSize: 11,
        color: 'rgba(0,0,0,0.72)',
        width: props.w,
        maxWidth: props.w,
        borderBottom: '1px solid rgba(0,0,0,0.12)',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#f4f4f4',
        boxShadow: '0 2px 0 rgba(0,0,0,0.06)',
        whiteSpace: 'nowrap',
        fontWeight: 800,
      }}
    >
      {props.children}
    </th>
  )
}

function TdRead(props: {
  value: string
  center?: boolean
  gray?: boolean
  singleLine?: boolean
  multiLine?: boolean
  style?: React.CSSProperties
}) {
  const lineClass = props.multiLine ? 'multiLine' : props.singleLine ? 'singleLine' : 'multiLine'
  return (
    <td className={['pfmeaTd', props.gray ? 'gray' : '', props.center ? 'center' : '', lineClass].join(' ')} style={{ ...(props.style ?? {}) }}>
      {props.value || ''}
    </td>
  )
}

function TdText(props: {
  value: string
  editing: boolean
  onStart: () => void
  onCommit: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
  editorRef: React.RefObject<any>
  stopEdit: () => void
  singleLine?: boolean
}) {
  const [val, setVal] = useState(props.value ?? '')
  const localRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  useEffect(() => setVal(props.value ?? ''), [props.value])

  useEffect(() => {
    if (!props.editing) return
    if (props.singleLine) return
    const t = localRef.current as HTMLTextAreaElement | null
    if (!t) return
    t.style.height = '0px'
    t.style.height = Math.max(18, t.scrollHeight) + 'px'
  }, [props.editing, props.singleLine, val])

  if (!props.editing) {
    return (
      <td className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : 'multiLine'}`} onClick={props.onStart} title={props.singleLine ? val : undefined}>
        {val || ''}
      </td>
    )
  }

  return (
    <td className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : 'multiLine'}`}>
      {props.singleLine ? (
        <input
          className="pfmeaEditor"
          ref={(el) => {
            localRef.current = el
            props.editorRef.current = el
          }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={props.onKeyDown as any}
          onBlur={() => {
            props.stopEdit()
            if (val !== (props.value ?? '')) props.onCommit(val)
          }}
          style={editorBase}
        />
      ) : (
        <textarea
          className="pfmeaEditor"
          ref={(el) => {
            localRef.current = el
            props.editorRef.current = el
          }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={props.onKeyDown as any}
          onBlur={() => {
            props.stopEdit()
            if (val !== (props.value ?? '')) props.onCommit(val)
          }}
          style={editorBase}
        />
      )}
    </td>
  )
}

function TdNum(props: {
  value: number | null
  editing: boolean
  onStart: () => void
  onCommit: (n: number | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  editorRef: React.RefObject<any>
  stopEdit: () => void
}) {
  const [val, setVal] = useState(props.value == null ? '' : String(props.value))
  useEffect(() => setVal(props.value == null ? '' : String(props.value)), [props.value])

  const onChangeStrict = (s: string) => {
    if (s === '') {
      setVal('')
      return
    }
    if (!/^\d{1,2}$/.test(s)) return
    const n = Number(s)
    if (!Number.isFinite(n)) return
    if (n < 1 || n > 10) return
    setVal(String(n))
  }

  const onKeyDownStrict = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter']
    if (allowed.includes(e.key)) return
    if (/^\d$/.test(e.key)) return
    e.preventDefault()
  }

  if (!props.editing) {
    return (
      <td className="pfmeaTd editable center singleLine" onClick={props.onStart}>
        {val || ''}
      </td>
    )
  }

  return (
    <td className="pfmeaTd editable center singleLine">
      <input
        className="pfmeaEditor"
        ref={(el) => (props.editorRef.current = el)}
        value={val}
        inputMode="numeric"
        onKeyDown={(e) => {
          onKeyDownStrict(e)
          props.onKeyDown(e)
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          const t = text.trim()
          if (!(t === '' || toInt_1_10_orNull(t) != null)) e.preventDefault()
        }}
        onChange={(e) => onChangeStrict(e.target.value)}
        onBlur={() => {
          props.stopEdit()
          props.onCommit(toInt_1_10_orNull(val))
        }}
        style={{ ...editorBase, textAlign: 'center' as const }}
      />
    </td>
  )
}

function TdDate(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  editorRef: React.RefObject<any>
  stopEdit: () => void
}) {
  const [val, setVal] = useState(props.value ?? '')
  useEffect(() => setVal(props.value ?? ''), [props.value])

  if (!props.editing) {
    return (
      <td className="pfmeaTd editable singleLine" onClick={props.onStart}>
        {val || ''}
      </td>
    )
  }

  return (
    <td className="pfmeaTd editable singleLine">
      <input
        className="pfmeaEditor"
        ref={(el) => (props.editorRef.current = el)}
        type="date"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={props.onKeyDown}
        onBlur={() => {
          props.stopEdit()
          props.onCommit(val ? val : null)
        }}
        style={editorBase}
      />
    </td>
  )
}

function TdSelect(props: {
  value: string | null
  editing: boolean
  onStart: () => void
  onCommit: (v: string | null) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLSelectElement>) => void
  editorRef: React.RefObject<any>
  stopEdit: () => void
  options: string[]
}) {
  const [val, setVal] = useState(props.value ?? '')
  useEffect(() => setVal(props.value ?? ''), [props.value])

  if (!props.editing) {
    return (
      <td className="pfmeaTd editable singleLine" onClick={props.onStart}>
        {val || ''}
      </td>
    )
  }

  return (
    <td className="pfmeaTd editable singleLine">
      <select
        className="pfmeaEditor"
        ref={(el) => (props.editorRef.current = el)}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={props.onKeyDown as any}
        onBlur={() => {
          props.stopEdit()
          props.onCommit(val ? val : null)
        }}
        style={{ ...editorBase, paddingRight: 16 }}
      >
        <option value=""></option>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </td>
  )
}

/** ===================== STYLES ===================== */
const lbl: React.CSSProperties = { fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 700 }

const panel: React.CSSProperties = {
  marginTop: 12,
  width: '100%',
  padding: 12,
  border: '1px solid #eee',
  borderRadius: 12,
  background: 'white',
  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
}

const input: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  outline: 'none',
  fontWeight: 700,
  background: 'white',
  fontSize: 12,
}

const pillBtn: React.CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: 'white',
  cursor: 'pointer',
  fontWeight: 800,
  boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
  fontSize: 12,
}

const pillLink: React.CSSProperties = {
  ...pillBtn,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const editorBase: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  lineHeight: 1.25,
  fontWeight: 500,
  fontSize: 12,
  fontFamily: 'inherit',
  minHeight: 18,
}
