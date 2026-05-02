import { appButtonClassName } from '@/components/ui/primitives'

type ConfirmDialogProps = {
  busy?: boolean
  body: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  open: boolean
  title: string
}

export function ConfirmDialog({
  busy = false,
  body,
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-xl font-semibold text-slate-950">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className={appButtonClassName('secondary')} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={appButtonClassName('primary')} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
