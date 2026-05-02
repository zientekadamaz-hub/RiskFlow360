export type EffectiveRatingScaleRow = {
  active: boolean
  description?: string | null
  level: number
  modified_at?: string | null
  modified_by_name?: string | null
  name: string
}

export type RatingScaleUiRow = {
  active: boolean
  description: string
  definition: string
  examples: string[]
  level: number
  modified_at?: string | null
  modified_by_name?: string | null
  name: string
  title: string
}

export type RatingScaleCacheEntry = {
  orgId: string | null
  orgName: string | null
  rows: RatingScaleUiRow[]
  ts: number
}

export type RatingScaleConfirmState =
  | null
  | {
      body: string
      confirmLabel: string
      title: string
      onConfirm: () => Promise<void>
    }

export type RatingScaleSortDirection = 'asc' | 'desc'
export type RatingScaleSortableColumn = 'level' | 'title' | 'definition' | 'examples' | 'status'
export type RatingScaleHiddenColumnsState = Record<RatingScaleSortableColumn, boolean>
