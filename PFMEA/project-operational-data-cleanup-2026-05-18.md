# Project Operational Data Cleanup - 2026-05-18

## Scope

Cleaned project-related operational data from the linked Supabase test database.

Preserved:
- auth users and profiles
- organizations
- organization members and licenses
- access requests
- sites/departments
- risk matrix configuration and cells
- severity/occurrence/detection defaults

Deleted:
- projects
- operations
- process revisions
- PFMEA rows and edit sessions/history
- PFD diagrams/drafts/nodes/edges/sessions/history
- PCP control plan rows, edit sessions/history
- customer access grants linked to deleted projects

## Pre-cleanup Counts

| Table / area | Rows |
| --- | ---: |
| projects | 45 |
| operations | 80 |
| process_revisions | 259 |
| pfmea_rows | 1622 |
| control_plan_rows | 161 |
| pfd_diagrams | 6 |
| pfd_drafts | 3 |
| pfd_edit_sessions | 3 |
| pfmea_edit_sessions | 6 |
| pfmea_change_history | 161 |
| pfd_change_history | 32 |
| pcp_change_history | 27 |
| customer_access_grants with project_id | 22 |

## Post-cleanup Counts

All project-related operational tables above returned `0` rows after cleanup.

## Safety Notes

The cleanup was executed through `scripts/supabase/cleanup-project-operational-data.sql` in a single SQL transaction.

The script first collected affected project, revision, operation, PFMEA row, and PFD node IDs into temporary tables, then deleted child records before parent records to respect foreign keys.

## Preserved Configuration Counts After Cleanup

| Table / area | Rows |
| --- | ---: |
| organizations | 32 |
| profiles | 56 |
| organization_members | 56 |
| organization_license | 32 |
| site_departments | 42 |
| risk_matrix_config | 2 |
| risk_matrix_cells | 250 |
| severity_defaults | 10 |
| occurrence_defaults | 10 |
| detection_defaults | 10 |
| access_requests | 1 |

## Next Step

Create clean test projects from the application UI or add a dedicated seed script that creates fresh Projects, PFD, PFMEA, PCP, and report-ready data without carrying over legacy row/group inconsistencies.
