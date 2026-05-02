'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import { CustomerAccessPanel, type CustomerAccessSummary } from '@/features/settings/CustomerAccessPanel'
import {
  SettingsPageShell,
  SettingsSection,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  getSettingsSummaryGridMaxWidth,
  settingsProcessAccent,
} from '@/features/settings/invitation-shell'
import { projectsSummaryValueStyle } from '@/features/projects/view-styles'

type ProfileRow = {
  active_organization_id?: string | null
}

type HeaderRow = {
  org_name?: string | null
  org_role?: string | null
  global_role?: string | null
}

export default function SettingsCustomerAccessPage() {
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgRole, setOrgRole] = useState<string | null>(null)
  const [globalRole, setGlobalRole] = useState<string | null>(null)
  const [summary, setSummary] = useState<CustomerAccessSummary | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        window.location.assign('/login')
        return
      }

      const [profileRes, headerRes] = await Promise.all([
        supabase.from('profiles').select('active_organization_id').eq('id', session.user.id).maybeSingle(),
        supabase.rpc('get_my_header').maybeSingle(),
      ])

      if (!mounted) return

      const organizationId = (profileRes.data as ProfileRow | null)?.active_organization_id ?? null
      const header = (headerRes.data as HeaderRow | null) ?? null

      setOrgId(organizationId)
      setOrgName(header?.org_name ?? null)
      setOrgRole(header?.org_role ?? null)
      setGlobalRole(header?.global_role ?? null)
      setLoading(false)
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <SettingsPageShell
        title="Customer Access"
        titleStyle={{ color: settingsProcessAccent }}
        subtitle="Grant customers read access only to the modules they should see in the active organization."
      >
        <SettingsSection style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Loading customer access controls...</div>
        </SettingsSection>
      </SettingsPageShell>
    )
  }

  const canManage = globalRole === 'admin' || orgRole === 'champion'

  return (
    <SettingsPageShell
      title="Customer Access"
      titleStyle={{ color: settingsProcessAccent }}
      subtitle={
        <>
          Grant customers read access only to the specific <b>PFD</b>, <b>PFMEA</b> or <b>PCP</b> modules they should see in{' '}
          <b>{orgName ?? 'the active organization'}</b>.
        </>
      }
      summary={
        summary ? (
          <div style={{ width: '100%', maxWidth: getSettingsSummaryGridMaxWidth(3), marginLeft: 'auto' }}>
            <SettingsSummaryGrid columns={3} maxWidth={getSettingsSummaryGridMaxWidth(3)}>
              <SettingsSummaryTile label="Customers" value={summary.customers} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
              <SettingsSummaryTile label="Active grants" value={summary.grants} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
              <SettingsSummaryTile label="Projects in org" value={summary.projects} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
            </SettingsSummaryGrid>
          </div>
        ) : undefined
      }
    >
      <CustomerAccessPanel
        organizationId={orgId}
        organizationName={orgName}
        canManage={canManage}
        onSummaryChange={setSummary}
      />
    </SettingsPageShell>
  )
}
