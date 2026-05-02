'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import {
  getActiveOrganizationId,
  getDisplayName,
  getHeaderContext,
  getSessionUserWithRetries,
  withTimeout,
} from '@/lib/auth/client-session'
import type { RatingScaleConfig } from '@/features/settings/rating-scale/config'
import {
  SettingsBanner,
  SettingsConfirmDialog,
  SettingsPageShell,
  SettingsSection,
  settingsProcessAccent,
} from '@/features/settings/invitation-shell'
import { RatingScaleTable } from './RatingScaleTable'
import type {
  EffectiveRatingScaleRow,
  RatingScaleCacheEntry,
  RatingScaleConfirmState,
  RatingScaleHiddenColumnsState,
  RatingScaleSortableColumn,
  RatingScaleSortDirection,
  RatingScaleUiRow,
} from './types'
import {
  DEFAULT_HIDDEN_COLUMNS,
  normalizeRows,
  QUERY_TIMEOUT_MS,
  readCache,
  splitName,
  writeCache,
} from './utils'

export function RatingScalePage({ config }: { config: RatingScaleConfig }) {
  const [initialCache] = useState<RatingScaleCacheEntry | null>(() => readCache(config.cacheKey))
  const [orgId, setOrgId] = useState<string | null>(() => initialCache?.orgId ?? null)
  const [orgName, setOrgName] = useState<string | null>(() => initialCache?.orgName ?? null)
  const [rows, setRows] = useState<RatingScaleUiRow[]>(() => initialCache?.rows ?? [])
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(rows.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<RatingScaleConfirmState>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [sortState, setSortState] = useState<{ column: RatingScaleSortableColumn; direction: RatingScaleSortDirection }>({
    column: 'level',
    direction: 'desc',
  })
  const [hiddenColumns, setHiddenColumns] = useState<RatingScaleHiddenColumnsState>(DEFAULT_HIDDEN_COLUMNS)
  const [statusFilterValues, setStatusFilterValues] = useState<string[]>(['ACTIVE', 'INACTIVE'])

  useEffect(() => {
    let active = true

    async function loadData(showLoader: boolean) {
      if (showLoader) setLoading(true)
      setError(null)

      const user = await getSessionUserWithRetries()
      if (!active) return

      if (!user) {
        setError('No authenticated user.')
        setLoading(false)
        return
      }

      let activeOrganizationId: string | null = null
      try {
        activeOrganizationId = await getActiveOrganizationId(user.id)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load active organization.')
        setLoading(false)
        return
      }

      if (!activeOrganizationId) {
        setError('No active organization selected.')
        setLoading(false)
        return
      }

      setOrgId(activeOrganizationId)

      const headerResult = await getHeaderContext()
      if (!active) return

      if (headerResult.status !== 'error') {
        setOrgName(headerResult.row?.org_name ?? null)
        setCurrentUserName(getDisplayName(headerResult.row?.first_name, headerResult.row?.last_name))
      }

      try {
        const listResult = await withTimeout(
          supabase.rpc(config.effectiveRpc, {
            p_org: activeOrganizationId,
          }),
          QUERY_TIMEOUT_MS
        )

        if (listResult.error) {
          setError(listResult.error.message)
          setLoading(false)
          return
        }

        const nextRows = normalizeRows(config, (listResult.data ?? []) as EffectiveRatingScaleRow[])
        setRows(nextRows)
        setLoading(false)
        writeCache(config.cacheKey, {
          orgId: activeOrganizationId,
          orgName: headerResult.status === 'error' ? null : headerResult.row?.org_name ?? null,
          rows: nextRows,
        })
      } catch {
        setError(`${config.title} data read timed out. Try again.`)
        setLoading(false)
      }
    }

    if (initialCache?.rows?.length) {
      void loadData(false)
    } else {
      void loadData(true)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      window.sessionStorage.removeItem(config.cacheKey)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [config, initialCache?.rows?.length])

  useEffect(() => {
    if (!orgId || rows.length === 0) return
    writeCache(config.cacheKey, { orgId, orgName, rows })
  }, [config.cacheKey, orgId, orgName, rows])

  async function updateRow(
    row: RatingScaleUiRow,
    changes: Partial<Pick<RatingScaleUiRow, 'active' | 'definition' | 'description' | 'name' | 'title'>>
  ) {
    if (!orgId) return

    setError(null)

    const payload: Record<string, string | number | boolean> = {
      organization_id: orgId,
      level: row.level,
    }

    if (changes.name !== undefined) {
      const trimmedName = changes.name.trim()
      if (!trimmedName) {
        setError('Name is required.')
        return
      }
      payload.name = trimmedName
    }

    if (changes.description !== undefined) {
      payload.description = changes.description.trim()
    }

    if (changes.active !== undefined) {
      payload.active = changes.active
    }

    const result = await supabase.from(config.overridesTable).upsert(payload, {
      onConflict: 'organization_id,level',
    })

    if (result.error) {
      setError(result.error.message)
      return
    }

    const now = new Date().toISOString()
    setRows((current) =>
      current.map((currentRow) => {
        if (currentRow.level !== row.level) return currentRow

        const description = changes.description !== undefined ? changes.description.trim() : currentRow.description
        return {
          ...currentRow,
          ...changes,
          name: changes.name !== undefined ? changes.name.trim() : currentRow.name,
          title: changes.title !== undefined ? changes.title.trim() : currentRow.title,
          definition: changes.definition !== undefined ? changes.definition.trim() : currentRow.definition,
          description,
          examples: description
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          modified_by_name: currentUserName ?? currentRow.modified_by_name ?? null,
          modified_at: now,
        }
      })
    )
  }

  async function restoreDefaults(row: RatingScaleUiRow) {
    if (!orgId) return

    setError(null)

    const result = await supabase
      .from(config.overridesTable)
      .delete()
      .eq('organization_id', orgId)
      .eq('level', row.level)

    if (result.error) {
      setError(result.error.message)
      return
    }

    const defaults = config.defaults[row.level]
    const name = defaults?.name ?? ''
    const description = defaults?.description ?? ''
    const split = splitName(name)
    setRows((current) =>
      current.map((currentRow) =>
        currentRow.level === row.level
          ? {
              ...currentRow,
              name,
              title: split.title,
              definition: split.definition,
              description,
              examples: description
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
              active: true,
              modified_by_name: null,
              modified_at: null,
            }
          : currentRow
      )
    )
  }

  const displayRows = useMemo(() => {
    const nextRows = rows.filter((row) => {
      const statusLabel = row.active ? 'ACTIVE' : 'INACTIVE'
      return statusFilterValues.includes(statusLabel)
    })

    nextRows.sort((left, right) => {
      const directionFactor = sortState.direction === 'asc' ? 1 : -1

      if (sortState.column === 'level') {
        return (left.level - right.level) * directionFactor
      }

      if (sortState.column === 'status') {
        const leftStatus = left.active ? 'ACTIVE' : 'INACTIVE'
        const rightStatus = right.active ? 'ACTIVE' : 'INACTIVE'
        return leftStatus.localeCompare(rightStatus) * directionFactor
      }

      if (sortState.column === 'title') {
        return left.title.localeCompare(right.title) * directionFactor
      }

      if (sortState.column === 'definition') {
        return left.definition.localeCompare(right.definition) * directionFactor
      }

      return (left.description || '').localeCompare(right.description || '') * directionFactor
    })

    return nextRows
  }, [rows, sortState, statusFilterValues])

  return (
    <SettingsPageShell
      title={config.title}
      titleStyle={{ color: settingsProcessAccent }}
      subtitle={config.description}
    >
      {error ? (
        <SettingsBanner tone="error">
          <b>Error:</b> {error}
        </SettingsBanner>
      ) : null}

      {loading ? (
        <SettingsSection style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Loading {config.title.toLowerCase()} settings...</p>
        </SettingsSection>
      ) : rows.length === 0 ? (
        <SettingsBanner tone="neutral">
          <b>{config.emptyMessage}</b> {config.description}
        </SettingsBanner>
      ) : (
        <SettingsSection style={{ padding: 0, overflow: 'visible' }}>
          <RatingScaleTable
            config={config}
            displayRows={displayRows}
            hiddenColumns={hiddenColumns}
            onRequestConfirm={setConfirm}
            onRestoreDefaults={restoreDefaults}
            onUpdate={updateRow}
            setHiddenColumns={setHiddenColumns}
            setSortState={setSortState}
            setStatusFilterValues={setStatusFilterValues}
            statusFilterValues={statusFilterValues}
          />
        </SettingsSection>
      )}

      <SettingsConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        body={confirm?.body ?? ''}
        confirmLabel={confirm?.confirmLabel}
        busy={confirmBusy}
        onCancel={() => {
          if (confirmBusy) return
          setConfirm(null)
        }}
        onConfirm={async () => {
          if (!confirm) return
          setConfirmBusy(true)
          try {
            await confirm.onConfirm()
            setConfirm(null)
          } finally {
            setConfirmBusy(false)
          }
        }}
      />
    </SettingsPageShell>
  )
}
