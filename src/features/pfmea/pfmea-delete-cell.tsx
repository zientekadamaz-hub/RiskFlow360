type PfmeaDeleteCellProps = {
  isEditOwner: boolean
  isPlaceholder: boolean
  onDelete: () => void
  readOnly: boolean
}

export function PfmeaDeleteCell({
  isEditOwner,
  isPlaceholder,
  onDelete,
  readOnly,
}: PfmeaDeleteCellProps) {
  return (
    <td className="pfmeaTd center" style={{ padding: '10px 8px !important' }}>
      {!isPlaceholder && isEditOwner ? (
        <button
          className="trashBtn"
          onClick={onDelete}
          aria-label="Delete row"
          title={readOnly ? 'Read-only' : 'Delete'}
          disabled={readOnly}
          style={{ opacity: readOnly ? 0.4 : 1, cursor: readOnly ? 'not-allowed' : 'pointer' }}
        >
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
      ) : (
        <span aria-hidden="true" style={{ display: 'inline-block', width: 36, height: 29, opacity: 0 }} />
      )}
    </td>
  )
}
