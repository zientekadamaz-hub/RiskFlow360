import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import {
  SettingsActionColumnHeader,
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
import { projectsTableHeaderStyle } from '@/features/projects/view-styles'
import type { InvitationHiddenColumns, InvitationSortState } from './invitations-page-model'

type InvitationsTableHeaderProps = {
  emailOptions: string[]
  hiddenColumns: InvitationHiddenColumns
  hiddenHeaderStyle: CSSProperties
  nameOptions: string[]
  roleOptions: string[]
  selectedEmails: string[]
  selectedNames: string[]
  selectedRoles: string[]
  selectedStatuses: string[]
  setHiddenColumns: Dispatch<SetStateAction<InvitationHiddenColumns>>
  setSelectedEmails: (values: string[] | null) => void
  setSelectedNames: (values: string[] | null) => void
  setSelectedRoles: (values: string[] | null) => void
  setSelectedStatuses: (values: string[] | null) => void
  setSortState: Dispatch<SetStateAction<InvitationSortState>>
  statusOptions: string[]
}

export function InvitationsTableHeader({
  emailOptions,
  hiddenColumns,
  hiddenHeaderStyle,
  nameOptions,
  roleOptions,
  selectedEmails,
  selectedNames,
  selectedRoles,
  selectedStatuses,
  setHiddenColumns,
  setSelectedEmails,
  setSelectedNames,
  setSelectedRoles,
  setSelectedStatuses,
  setSortState,
  statusOptions,
}: InvitationsTableHeaderProps) {
  return (
    <thead>
      <tr>
        <th style={hiddenColumns.name ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.name ? (
            <SettingsHiddenColumnHeader label="Name" onShow={() => setHiddenColumns((current) => ({ ...current, name: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Name"
              values={nameOptions}
              selectedValues={selectedNames}
              onApplyValues={setSelectedNames}
              onSort={(direction) => setSortState({ column: 'name', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, name: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.email ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.email ? (
            <SettingsHiddenColumnHeader label="Email" onShow={() => setHiddenColumns((current) => ({ ...current, email: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Email"
              values={emailOptions}
              selectedValues={selectedEmails}
              onApplyValues={setSelectedEmails}
              onSort={(direction) => setSortState({ column: 'email', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, email: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.role ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.role ? (
            <SettingsHiddenColumnHeader label="Role" onShow={() => setHiddenColumns((current) => ({ ...current, role: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Role"
              values={roleOptions}
              selectedValues={selectedRoles}
              onApplyValues={setSelectedRoles}
              onSort={(direction) => setSortState({ column: 'role', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, role: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.status ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.status ? (
            <SettingsHiddenColumnHeader label="Status" onShow={() => setHiddenColumns((current) => ({ ...current, status: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Status"
              values={statusOptions}
              selectedValues={selectedStatuses}
              onApplyValues={setSelectedStatuses}
              onSort={(direction) => setSortState({ column: 'status', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, status: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.created ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.created ? (
            <SettingsHiddenColumnHeader label="Created" onShow={() => setHiddenColumns((current) => ({ ...current, created: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Created"
              onSort={(direction) => setSortState({ column: 'created', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, created: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.accepted ? hiddenHeaderStyle : projectsTableHeaderStyle}>
          {hiddenColumns.accepted ? (
            <SettingsHiddenColumnHeader label="Accepted" onShow={() => setHiddenColumns((current) => ({ ...current, accepted: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Accepted"
              onSort={(direction) => setSortState({ column: 'accepted', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, accepted: true }))}
            />
          )}
        </th>
        <th style={projectsTableHeaderStyle}>
          <SettingsActionColumnHeader label="Actions" onSort={(direction) => setSortState({ column: 'name', direction })} />
        </th>
      </tr>
    </thead>
  )
}
