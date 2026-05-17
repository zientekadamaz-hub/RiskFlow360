import React, { type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

import { buildPfmeaActionPlanValidationRow, getPfmeaMissingActionPlanHighlightKeys, getPreviousRequiredFieldForActionPlan } from './pfmea-action-validation-utils'
import { PfmeaActionClosureCells } from './pfmea-action-closure-cells'
import { PfmeaCauseCurrentControlCells } from './pfmea-cause-current-control-cells'
import type { PfmeaColumnId, PfmeaEditableField } from './pfmea-columns'
import { PfmeaCurrentRiskCells } from './pfmea-current-risk-cells'
import { PfmeaDeleteCell } from './pfmea-delete-cell'
import { PfmeaFailureEffectCells } from './pfmea-failure-effect-cells'
import { PfmeaFailureModeCells } from './pfmea-failure-mode-cells'
import type { PfmeaRowHierarchy } from './pfmea-hierarchy-utils'
import { PfmeaOperationCells } from './pfmea-operation-cells'
import { PfmeaRecommendedActionCells } from './pfmea-recommended-action-cells'
import { PfmeaResidualRiskCells } from './pfmea-residual-risk-cells'
import type { RiskColor } from './pfmea-risk-matrix-config'
import { computePfmeaDerivedFromContext as computePfmeaDerivedFromRowContext, getPfmeaFailureBlockSourceRowAtIndex, getPfmeaRecommendedActionContinuationSourceRow } from './pfmea-row-context-utils'
import { buildPfmeaTableRowModel } from './pfmea-table-row-model'
import { resolvePfmeaBlockEndAnchorRow, type PfmeaMergeInfo } from './pfmea-table-merge-utils'
import type { PfmeaEditorElement, PfmeaRow, SeverityOption } from './pfmea-types'

type PfmeaEditState = { rowId: string; col: keyof PfmeaRow } | null
type PfmeaPatch = Partial<PfmeaRow>

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function PfmeaTableBody(props: {
  actionPlanBlockMergeInfo: PfmeaMergeInfo[]
  addCauseContinuationRow: (sourceRow: PfmeaRow, anchorRow: PfmeaRow) => Promise<void>
  addEffectContinuationRow: (sourceRow: PfmeaRow, anchorRow: PfmeaRow) => Promise<void>
  addFailureModeContinuationRow: (sourceRow: PfmeaRow, anchorRow: PfmeaRow) => Promise<void>
  addRecommendedActionContinuationRow: (sourceRow: PfmeaRow, anchorRow: PfmeaRow) => Promise<void>
  applyPendingCellValues: (row: PfmeaRow) => PfmeaRow
  clearRecommendedActionTransientIfFilled: (rowId: string, value: string) => void
  colOrder: PfmeaEditableField[]
  deleteRow: (rowId: string) => Promise<void>
  detectionOptions: SeverityOption[]
  edit: PfmeaEditState
  editorRef: MutableRefObject<PfmeaEditorElement | null>
  failureBlockMergeInfo: PfmeaMergeInfo[]
  failureModeMergeInfo: PfmeaMergeInfo[]
  getRiskColorFor: (severity: number | null, doValue: number | null) => RiskColor | null
  handleCellKeyDown: (
    event: React.KeyboardEvent<Element>,
    rowIndex: number,
    colIndex: number,
    allowEnterNewline: boolean
  ) => void
  highlightedMissingCells: string[] | null
  isColumnVisible: (columnId: PfmeaColumnId) => boolean
  isEditOwner: boolean
  materializePlaceholderRowForAdd: (row: PfmeaRow) => Promise<PfmeaRow>
  mergeInfo: PfmeaMergeInfo[]
  occurrenceOptions: SeverityOption[]
  readOnly: boolean
  rowHierarchyById: Map<string, PfmeaRowHierarchy>
  rowsRef: MutableRefObject<PfmeaRow[]>
  setEdit: Dispatch<SetStateAction<PfmeaEditState>>
  setErr: Dispatch<SetStateAction<string>>
  setExpandedOperationId: Dispatch<SetStateAction<string | null>>
  setHighlightedMissingCells: Dispatch<SetStateAction<string[] | null>>
  setPendingCellValue: (rowId: string, col: keyof PfmeaRow, value: unknown) => void
  severityOptions: SeverityOption[]
  startEditCell: (row: PfmeaRow, col: keyof PfmeaRow) => Promise<void>
  tableRows: PfmeaRow[]
  updateCellWithDerived: (row: PfmeaRow, patch: PfmeaPatch) => Promise<void>
}) {
  return (
    <tbody>
      {props.tableRows.map((r, rowIndex) => {
        const {
          actionPlanBlockSpan,
          actionPlanOwnerRow,
          canAddCauseRow,
          canAddEffectRow,
          canAddFailureModeRow,
          canAddRecommendedActionRow,
          currentRisk: a1,
          effectiveActionPlanOwnerRow,
          effectiveCurrentRow,
          effectiveFailureBlockOwnerRow,
          effectiveFailureModeOwnerRow,
          failureBlockOwnerRow,
          failureBlockSpan,
          failureModeOwnerRow,
          failureModeSpan,
          groupStart,
          isMissingHighlighted,
          isPlaceholder,
          latestRowForHighlights,
          operationName,
          opNo,
          pcpAutoReasons,
          pcpChecked,
          pcpDisabled,
          residualRisk: a2,
          riskRpn2Style,
          riskRpnStyle,
          rowNumber,
          span,
          station,
          step,
        } = buildPfmeaTableRowModel({
          actionPlanBlockMergeInfo: props.actionPlanBlockMergeInfo,
          applyPendingCellValues: props.applyPendingCellValues,
          computeDerivedFromContext: (row) => computePfmeaDerivedFromRowContext(row, props.tableRows, props.applyPendingCellValues),
          failureBlockMergeInfo: props.failureBlockMergeInfo,
          failureModeMergeInfo: props.failureModeMergeInfo,
          getRiskColorFor: props.getRiskColorFor,
          highlightedMissingCells: props.highlightedMissingCells,
          mergeInfo: props.mergeInfo,
          readOnly: props.readOnly,
          row: r,
          rowHierarchyById: props.rowHierarchyById,
          rowIndex,
          sourceRows: props.rowsRef.current,
          tableRows: props.tableRows,
        })
        const runActionPlanStart = (targetCol: keyof PfmeaRow) => {
          window.setTimeout(() => {
            const latestRow = latestRowForHighlights
            const contextualActionRow = getPfmeaRecommendedActionContinuationSourceRow(
              buildPfmeaActionPlanValidationRow({
                actionPlanOwnerRow: effectiveActionPlanOwnerRow,
                currentRow: latestRow,
                failureBlockOwnerRow: effectiveFailureBlockOwnerRow,
                failureModeOwnerRow: effectiveFailureModeOwnerRow,
              }) as PfmeaRow,
              props.tableRows,
              props.applyPendingCellValues
            )
            const missingFields = getPreviousRequiredFieldForActionPlan(targetCol, contextualActionRow)
            if (props.readOnly) return
            if (missingFields.length === 0) {
              void props.startEditCell(latestRow, targetCol)
              return
            }
            const highlightKeys = getPfmeaMissingActionPlanHighlightKeys(missingFields, {
              actionPlanOwnerRow,
              currentRow: latestRowForHighlights,
              failureBlockOwnerRow,
              failureModeOwnerRow,
            })
            props.setHighlightedMissingCells(highlightKeys)
          }, 0)
        }

        return (
          <tr
            key={r.id}
            data-pfmea-row-id={r.id}
            data-pfmea-row-no={rowNumber ?? undefined}
            className={`pfmeaRow ${groupStart ? 'groupStart' : ''}`}
          >
            <PfmeaOperationCells
              isColumnVisible={props.isColumnVisible}
              onExpandOperation={props.setExpandedOperationId}
              operationId={r.operation_id || r.operations?.id || null}
              operationName={operationName}
              opNo={opNo}
              span={span}
              station={station}
              step={step}
            />

            <PfmeaFailureModeCells
              disabled={props.readOnly}
              edit={props.edit}
              editorRef={props.editorRef}
              effectiveFailureModeOwnerRow={effectiveFailureModeOwnerRow}
              failureModeSideAction={
                canAddFailureModeRow
                  ? {
                      title: 'Add failure mode row',
                      label: '+',
                      onClick: () => {
                        if (isPlaceholder) {
                          void (async () => {
                            try {
                              const materializedRow = await props.materializePlaceholderRowForAdd(r)
                              await props.addFailureModeContinuationRow(materializedRow, materializedRow)
                            } catch (error: unknown) {
                              props.setErr(errorMessage(error))
                            }
                          })()
                          return
                        }
                        const anchorRow = resolvePfmeaBlockEndAnchorRow(props.tableRows, rowIndex, props.failureModeMergeInfo) ?? r
                        void props.addFailureModeContinuationRow(r, anchorRow)
                      },
                    }
                  : undefined
              }
              failureModeSpan={failureModeSpan}
              isColumnVisible={props.isColumnVisible}
              isMissingHighlighted={isMissingHighlighted}
              onCellKeyDown={(event, columnId, allowEnterNewline) =>
                props.handleCellKeyDown(event, rowIndex, props.colOrder.indexOf(columnId), allowEnterNewline)
              }
              onCommit={(patch) => props.updateCellWithDerived(r, patch)}
              onLiveChange={(columnId, value) => props.setPendingCellValue(r.id, columnId, value)}
              onStart={(columnId) => void props.startEditCell(r, columnId)}
              rowId={r.id}
              stopEdit={() => props.setEdit(null)}
            />

            <PfmeaFailureEffectCells
              disabled={props.readOnly}
              edit={props.edit}
              editorRef={props.editorRef}
              effectRowId={r.id}
              effectSideAction={
                canAddEffectRow
                  ? {
                      title: 'Add effect row',
                      label: '+',
                      onClick: () => {
                        if (isPlaceholder) {
                          void (async () => {
                            try {
                              const materializedRow = await props.materializePlaceholderRowForAdd(r)
                              await props.addEffectContinuationRow(materializedRow, materializedRow)
                            } catch (error: unknown) {
                              props.setErr(errorMessage(error))
                            }
                          })()
                          return
                        }
                        const anchorRow = resolvePfmeaBlockEndAnchorRow(props.tableRows, rowIndex, props.failureBlockMergeInfo) ?? r
                        void props.addEffectContinuationRow(failureModeOwnerRow, anchorRow)
                      },
                    }
                  : undefined
              }
              effectiveFailureBlockOwnerRow={effectiveFailureBlockOwnerRow}
              failureBlockSpan={failureBlockSpan}
              isColumnVisible={props.isColumnVisible}
              isMissingHighlighted={isMissingHighlighted}
              onCellKeyDown={(event, columnId, allowEnterNewline) =>
                props.handleCellKeyDown(event, rowIndex, props.colOrder.indexOf(columnId), allowEnterNewline)
              }
              onEffectCommit={(value) => {
                props.setPendingCellValue(r.id, 'effect', value)
                props.updateCellWithDerived(r, { effect: value })
              }}
              onEffectLiveChange={(value) => props.setPendingCellValue(r.id, 'effect', value)}
              onEffectStart={() => void props.startEditCell(r, 'effect')}
              onSeverityCommit={(value) => {
                props.setPendingCellValue(failureBlockOwnerRow.id, 'severity', value)
                props.updateCellWithDerived(failureBlockOwnerRow, { severity: value })
              }}
              onSeverityLiveChange={(value) => props.setPendingCellValue(failureBlockOwnerRow.id, 'severity', value)}
              onSeverityStart={() => void props.startEditCell(failureBlockOwnerRow, 'severity')}
              severityOptions={props.severityOptions}
              severityRowId={failureBlockOwnerRow.id}
              stopEdit={() => props.setEdit(null)}
            />

            <PfmeaCauseCurrentControlCells
              actionPlanBlockSpan={actionPlanBlockSpan}
              causeSideAction={
                canAddCauseRow
                  ? {
                      title: 'Add cause row',
                      label: '+',
                      onClick: () => {
                        if (isPlaceholder) {
                          void (async () => {
                            try {
                              const materializedRow = await props.materializePlaceholderRowForAdd(r)
                              await props.addCauseContinuationRow(materializedRow, materializedRow)
                            } catch (error: unknown) {
                              props.setErr(errorMessage(error))
                            }
                          })()
                          return
                        }
                        const anchorRow = resolvePfmeaBlockEndAnchorRow(props.tableRows, rowIndex, props.actionPlanBlockMergeInfo) ?? r
                        const sourceRow = getPfmeaFailureBlockSourceRowAtIndex(rowIndex, props.tableRows, props.applyPendingCellValues) ?? failureBlockOwnerRow
                        void props.addCauseContinuationRow(sourceRow, anchorRow)
                      },
                    }
                  : undefined
              }
              detectionOptions={props.detectionOptions}
              disabled={props.readOnly}
              edit={props.edit}
              editorRef={props.editorRef}
              effectiveActionPlanOwnerRow={effectiveActionPlanOwnerRow}
              isColumnVisible={props.isColumnVisible}
              isMissingHighlighted={isMissingHighlighted}
              occurrenceOptions={props.occurrenceOptions}
              onCellKeyDown={(event, columnId, allowEnterNewline) =>
                props.handleCellKeyDown(event, rowIndex, props.colOrder.indexOf(columnId), allowEnterNewline)
              }
              onCommit={(patch) => props.updateCellWithDerived(r, patch)}
              onLiveChange={(columnId, value) => props.setPendingCellValue(r.id, columnId, value)}
              onStart={(columnId) => void props.startEditCell(r, columnId)}
              rowId={r.id}
              stopEdit={() => props.setEdit(null)}
            />

            <PfmeaCurrentRiskCells
              actionPlanBlockSpan={actionPlanBlockSpan}
              currentRpn={a1.rpn}
              isColumnVisible={props.isColumnVisible}
              onExpandOperation={props.setExpandedOperationId}
              onTogglePcp={() => {
                if (pcpDisabled) return
                void props.updateCellWithDerived(r, { pcp: !pcpChecked })
              }}
              operationId={r.operation_id || r.operations?.id || null}
              pcpAutoReasons={pcpAutoReasons}
              pcpChecked={pcpChecked}
              pcpDisabled={pcpDisabled}
              riskRpnStyle={riskRpnStyle}
            />

            <PfmeaRecommendedActionCells
              disabled={props.readOnly}
              edit={props.edit}
              editorRef={props.editorRef}
              effectiveCurrentRow={effectiveCurrentRow}
              isColumnVisible={props.isColumnVisible}
              isMissingHighlighted={isMissingHighlighted}
              onCellKeyDown={(event, columnId, allowEnterNewline) =>
                props.handleCellKeyDown(event, rowIndex, props.colOrder.indexOf(columnId), allowEnterNewline)
              }
              onCommit={(value) => {
                props.setPendingCellValue(r.id, 'recommended_action', value)
                props.clearRecommendedActionTransientIfFilled(r.id, value)
                props.updateCellWithDerived(r, { recommended_action: value })
              }}
              onLiveChange={(value) => {
                props.setPendingCellValue(r.id, 'recommended_action', value)
                props.clearRecommendedActionTransientIfFilled(r.id, value)
              }}
              onStart={() => runActionPlanStart('recommended_action')}
              recommendedActionSideAction={
                canAddRecommendedActionRow
                  ? {
                      title: 'Add recommended action row',
                      label: '+',
                      onClick: () => {
                        if (isPlaceholder) {
                          void (async () => {
                            try {
                              const materializedRow = await props.materializePlaceholderRowForAdd(r)
                              await props.addRecommendedActionContinuationRow(materializedRow, materializedRow)
                            } catch (error: unknown) {
                              props.setErr(errorMessage(error))
                            }
                          })()
                          return
                        }
                        void props.addRecommendedActionContinuationRow(r, r)
                      },
                    }
                  : undefined
              }
              rowId={r.id}
              stopEdit={() => props.setEdit(null)}
            />

            <PfmeaActionClosureCells
              disabled={props.readOnly}
              edit={props.edit}
              editorRef={props.editorRef}
              effectiveCurrentRow={effectiveCurrentRow}
              isColumnVisible={props.isColumnVisible}
              isMissingHighlighted={isMissingHighlighted}
              latestRowForHighlights={latestRowForHighlights}
              onCellKeyDown={(event, columnId, allowEnterNewline) =>
                props.handleCellKeyDown(event, rowIndex, props.colOrder.indexOf(columnId), allowEnterNewline)
              }
              onCommit={(patch) => props.updateCellWithDerived(r, patch)}
              onLiveChange={(columnId, value) => props.setPendingCellValue(r.id, columnId, value)}
              onStart={runActionPlanStart}
              rowId={r.id}
              stopEdit={() => props.setEdit(null)}
            />

            <PfmeaResidualRiskCells
              detectionOptions={props.detectionOptions}
              disabled={props.readOnly}
              edit={props.edit}
              isColumnVisible={props.isColumnVisible}
              isMissingHighlighted={isMissingHighlighted}
              latestRowForHighlights={latestRowForHighlights}
              onCellKeyDown={(event, columnId, allowEnterNewline) =>
                props.handleCellKeyDown(event, rowIndex, props.colOrder.indexOf(columnId), allowEnterNewline)
              }
              onCommit={(patch) => props.updateCellWithDerived(r, patch)}
              onExpandOperation={props.setExpandedOperationId}
              onLiveChange={(columnId, value) => props.setPendingCellValue(r.id, columnId, value)}
              onStart={runActionPlanStart}
              operationId={r.operation_id || r.operations?.id || null}
              occurrenceOptions={props.occurrenceOptions}
              residualRpn={a2.rpn}
              riskRpn2Style={riskRpn2Style}
              rowId={r.id}
              stopEdit={() => props.setEdit(null)}
            />

            {props.isColumnVisible('delete') ? (
              <PfmeaDeleteCell
                isEditOwner={props.isEditOwner}
                isPlaceholder={isPlaceholder}
                onDelete={() => props.deleteRow(r.id)}
                readOnly={props.readOnly}
              />
            ) : null}
          </tr>
        )
      })}
    </tbody>
  )
}
