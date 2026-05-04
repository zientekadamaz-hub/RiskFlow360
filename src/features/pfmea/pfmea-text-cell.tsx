import React, { useCallback, useEffect, useRef, useState } from 'react'
import { editorBase } from './pfmea-cell-styles'
import { MergedCellInner, mergedCellTdStyle } from './pfmea-merged-cell'

type PfmeaEditorElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
type PfmeaEditorRef = React.MutableRefObject<PfmeaEditorElement | null>

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
  const [draftValue, setDraftValue] = useState<string | null>(null)
  const localRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const initialEditValueRef = useRef(props.value ?? '')
  const wasEditingRef = useRef(false)
  const { editorRef } = props
  const val = props.editing ? draftValue ?? props.value ?? '' : props.value ?? ''

  useEffect(() => {
    if (props.editing && !wasEditingRef.current) {
      initialEditValueRef.current = props.value ?? ''
      setDraftValue(props.value ?? '')
    }
    if (!props.editing && wasEditingRef.current) {
      setDraftValue(null)
    }
    wasEditingRef.current = props.editing
  }, [props.editing, props.value])

  useEffect(() => {
    if (!props.editing) return
    if (props.singleLine) return
    const t = localRef.current as HTMLTextAreaElement | null
    if (!t) return
    t.style.height = '0px'
    t.style.height = `${Math.max(18, t.scrollHeight)}px`
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
    },
    [editorRef]
  )

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
        onClick={props.onStart}
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
                value={val}
                onChange={(e) => {
                  setDraftValue(e.target.value)
                  props.onLiveChange?.(e.target.value)
                }}
                onKeyDown={props.onKeyDown}
                onBlur={(e) => {
                  const nextVal = e.currentTarget.value
                  props.onLiveChange?.(nextVal)
                  if (nextVal !== initialEditValueRef.current) props.onCommit(nextVal)
                  setDraftValue(null)
                  props.stopEdit()
                }}
                style={editorBase}
              />
            ) : (
              <textarea
                className="pfmeaEditor"
                ref={setEditorRefs}
                value={val}
                onChange={(e) => {
                  setDraftValue(e.target.value)
                  props.onLiveChange?.(e.target.value)
                }}
                onKeyDown={props.onKeyDown}
                onBlur={(e) => {
                  const nextVal = e.currentTarget.value
                  props.onLiveChange?.(nextVal)
                  if (nextVal !== initialEditValueRef.current) props.onCommit(nextVal)
                  setDraftValue(null)
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
