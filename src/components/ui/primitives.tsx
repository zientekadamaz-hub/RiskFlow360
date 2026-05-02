import type { ReactNode } from 'react'

export function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

export function appButtonClassName(variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary') {
  const base =
    'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

  const variants = {
    primary:
      'border-slate-900 bg-slate-900 text-white hover:border-slate-700 hover:bg-slate-700 focus-visible:ring-slate-900',
    secondary:
      'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400',
    ghost:
      'border-transparent bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300',
    danger:
      'border-rose-600 bg-rose-600 text-white hover:border-rose-500 hover:bg-rose-500 focus-visible:ring-rose-500',
  }

  return joinClassNames(base, variants[variant])
}

export const appInputClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200'

export const appTextareaClassName = `${appInputClassName} min-h-28 resize-y`

type AppPageProps = {
  children: ReactNode
  className?: string
  narrow?: boolean
}

export function AppPage({ children, className, narrow = false }: AppPageProps) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-12">
      <div
        className={joinClassNames(
          'mx-auto w-full px-4 py-6 sm:px-6 lg:px-8',
          narrow ? 'max-w-4xl' : 'max-w-7xl',
          className
        )}
      >
        {children}
      </div>
    </main>
  )
}

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
        {description ? <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}

type SurfaceCardProps = {
  children: ReactNode
  className?: string
}

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <section className={joinClassNames('rounded-3xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </section>
  )
}

type StatusBannerProps = {
  children: ReactNode
  title?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

export function StatusBanner({ children, title, tone = 'neutral' }: StatusBannerProps) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-100 text-slate-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
  }

  return (
    <div className={joinClassNames('rounded-2xl border px-4 py-3 text-sm leading-6', tones[tone])}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  )
}

type FieldProps = {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-900">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  )
}
