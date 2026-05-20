import React, { useCallback, useEffect, useRef } from 'react'
import { editorBase } from './pfmea-cell-styles'
import { MergedCellInner, mergedCellTdStyle } from './pfmea-merged-cell'

type PfmeaEditorElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
type PfmeaEditorRef = React.MutableRefObject<PfmeaEditorElement | null>

function resizeTextareaToContent(el: HTMLTextAreaElement) {
  el.style.height = '0px'
  el.style.height = `${Math.max(18, el.scrollHeight)}px`
}

export function TdText(props: {
  value: string
  editing: boolean
  onStart: () => void
  onCommit: (v: string) => void
  onLiveChange?: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
  editorRef: PfmeaEditorRef
  stopEdit: () => void
  rowSpan?: number
  sideAction?: {
    title: string
    label: string
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  }
  singleLine?: boolean
  disabled?: boolean
  style?: React.CSSProperties
  flash?: boolean
  cellKey?: string
}) {
  const localRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const latestValueRef = useRef(props.value ?? '')
  const initialEditValueRef = useRef(props.value ?? '')
  const activeEditorNodeRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const { editorRef } = props
  const val = props.value ?? ''

  useEffect(() => {
    if (props.editing) return
    latestValueRef.current = val
  }, [props.editing, val])

  useEffect(() => {
    if (!props.editing) return
    if (props.singleLine) return
    const t = localRef.current as HTMLTextAreaElement | null
    if (!t) return
    resizeTextareaToContent(t)
  }, [props.editing, props.singleLine, val])

  const sideActionButton = props.sideAction && !props.disabled ? (
    <button
      type="button"
      className="pfmeaInlineAddBtn"
      title={props.sideAction.title}
      aria-label={props.sideAction.title}
      disabled={props.disabled}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onClick={(e) => {
        if (props.disabled) return
        e.preventDefault()
        e.stopPropagation()
        props.sideAction?.onClick(e)
      }}
    >
      {props.sideAction.label === '+' ? <span aria-hidden="true" className="pfmeaInlineAddGlyph" /> : props.sideAction.label}
    </button>
  ) : null
  const textCellShellClass = `pfmeaTextCellShell${props.sideAction ? ' hasSideAction' : ''}${props.editing ? ' showSideAction' : ''}`

  const setEditorRefs = useCallback(
    (el: HTMLTextAreaElement | HTMLInputElement | null) => {
      localRef.current = el
      editorRef.current = el
      if (!el) {
        activeEditorNodeRef.current = null
        return
      }
      if (activeEditorNodeRef.current === el) return

      activeEditorNodeRef.current = el
      initialEditValueRef.current = latestValueRef.current
      if (el instanceof HTMLTextAreaElement) resizeTextareaToContent(el)
      window.setTimeout(() => {
        if (activeEditorNodeRef.current !== el) return
        const end = el.value.length
        el.focus()
        el.setSelectionRange(end, end)
      }, 0)
    },
    [editorRef]
  )

  const startEditing = useCallback(() => {
    latestValueRef.current = val
    initialEditValueRef.current = val
    props.onStart()
  }, [props, val])

  if (props.disabled) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        className={`pfmeaTd ${props.singleLine ? 'singleLine' : 'multiLine'} ${props.flash ? 'flashMissing' : ''}`}
        style={mergedCellTdStyle(props.rowSpan, props.style)}
      >
        <MergedCellInner rowSpan={props.rowSpan}>
          <div className={textCellShellClass}>
            <div className="pfmeaTextCellContent">
              <span>{val || ''}</span>
            </div>
            {sideActionButton}
          </div>
        </MergedCellInner>
      </td>
    )
  }

  if (!props.editing) {
    return (
      <td
        data-pfmea-col={props.cellKey}
        rowSpan={props.rowSpan}
        className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : 'multiLine'} ${props.flash ? 'flashMissing' : ''}`}
        onClick={startEditing}
        title={props.singleLine ? val : undefined}
        style={mergedCellTdStyle(props.rowSpan, props.style)}
      >
        <MergedCellInner rowSpan={props.rowSpan}>
          <div className={textCellShellClass}>
            <div className="pfmeaTextCellContent">
              <span>{val || ''}</span>
            </div>
            {sideActionButton}
          </div>
        </MergedCellInner>
      </td>
    )
  }

  return (
    <td
      data-pfmea-col={props.cellKey}
      rowSpan={props.rowSpan}
      className={`pfmeaTd editable ${props.singleLine ? 'singleLine' : 'multiLine'} ${props.flash ? 'flashMissing' : ''}`}
      style={mergedCellTdStyle(props.rowSpan, props.style)}
    >
      <MergedCellInner rowSpan={props.rowSpan}>
        <div className={textCellShellClass}>
          <div className="pfmeaTextCellContent">
            {props.singleLine ? (
              <input
                className="pfmeaEditor"
                ref={setEditorRefs}
                defaultValue={val}
                onChange={(e) => {
                  props.onLiveChange?.(e.target.value)
                }}
                onKeyDown={props.onKeyDown}
                onBlur={(e) => {
                  const nextVal = e.currentTarget.value
                  props.onLiveChange?.(nextVal)
                  if (nextVal !== initialEditValueRef.current) props.onCommit(nextVal)
                  props.stopEdit()
                }}
                style={editorBase}
              />
            ) : (
              <textarea
                className="pfmeaEditor"
                ref={setEditorRefs}
                defaultValue={val}
                onChange={(e) => {
                  resizeTextareaToContent(e.currentTarget)
                  props.onLiveChange?.(e.target.value)
                }}
                onKeyDown={props.onKeyDown}
                onBlur={(e) => {
                  const nextVal = e.currentTarget.value
                  props.onLiveChange?.(nextVal)
                  if (nextVal !== initialEditValueRef.current) props.onCommit(nextVal)
                  props.stopEdit()
                }}
                style={editorBase}
              />
            )}
          </div>
          {sideActionButton}
        </div>
      </MergedCellInner>
    </td>
  )
}
