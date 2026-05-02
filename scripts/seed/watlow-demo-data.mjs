import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const orgName = 'WATLOW'

const demoProjects = [
  {
    aliases: ['Watlow Test Process 01', 'Cartridge Heater Assembly'],
    name: 'Cartridge Heater Assembly',
    status: 'OPEN',
    site: 'Wroclaw',
    department: 'Production',
    products: ['CH-240V', 'CH-480V'],
    revisions: { open: { pfd: 2, pfmea: 3, pcp: 1 } },
    comments: {
      pfd: 'Balanced operation sequence after fixture update.',
      pfmea: 'Added overheating and wiring damage scenarios after line review.',
      pcp: 'Aligned control plan checkpoints with latest validation release.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Heater winding damage', effect: 'No heat output at startup', cause: 'Insulation nick during winding', severity: 9, occurrence: 7, detection: 8 },
      { op: 20, rowNo: '20.1', failureMode: 'Terminal overload', effect: 'Connector overheating in service', cause: 'Torque not verified after crimping', severity: 8, occurrence: 6, detection: 7 },
    ],
    updatedDaysAgo: 1,
  },
  {
    aliases: ['Watlow Test Process 02', 'Sensor Lead Brazing'],
    name: 'Sensor Lead Brazing',
    status: 'OPEN',
    site: 'Krakow',
    department: 'Engineering',
    products: ['TC-SLIM', 'RTD-PRO'],
    revisions: { open: { pfd: 1, pfmea: 2, pcp: 1 } },
    comments: {
      pfd: 'Updated brazing sequence for new fixture family.',
      pfmea: 'Refined occurrence for cold joint and misalignment cases.',
      pcp: 'Added inspection frequency for braze wetting verification.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Cold braze joint', effect: 'Signal interruption in temperature loop', cause: 'Insufficient heat profile', severity: 9, occurrence: 5, detection: 6 },
      { op: 20, rowNo: '20.1', failureMode: 'Lead misalignment', effect: 'Assembly rework required', cause: 'Fixture pin wear', severity: 7, occurrence: 5, detection: 5 },
    ],
    updatedDaysAgo: 2,
  },
  {
    aliases: ['Watlow Test Process 03', 'Nozzle Calibration'],
    name: 'Nozzle Calibration',
    status: 'OPEN',
    site: 'Krakow',
    department: 'Quality',
    products: ['NZ-10', 'NZ-12'],
    revisions: { open: { pfd: 1, pfmea: 1, pcp: 1 } },
    comments: {
      pfd: 'Standardized calibration loop for nozzle family A.',
      pfmea: 'Added drift scenario for pressure offset verification.',
      pcp: 'Released final acceptance checks for calibrated nozzles.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Calibration drift', effect: 'Incorrect flow performance', cause: 'Sensor zero not reset', severity: 7, occurrence: 4, detection: 5 },
      { op: 20, rowNo: '20.1', failureMode: 'Wrong setup recipe', effect: 'Specification miss at customer startup', cause: 'Operator recipe selection error', severity: 8, occurrence: 3, detection: 5 },
    ],
    updatedDaysAgo: 3,
  },
  {
    aliases: ['Watlow Test Process 04', 'Insulation Potting'],
    name: 'Insulation Potting',
    status: 'OPEN',
    site: 'Poznan',
    department: 'Laboratory',
    products: ['INS-CORE', 'INS-LAB'],
    revisions: { open: { pfd: 1, pfmea: 1, pcp: 1 } },
    comments: {
      pfd: 'Released compact potting route for pilot batches.',
      pfmea: 'Added void formation and curing gap scenarios.',
      pcp: 'Documented sample cure inspection and visual acceptance.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Voids in potting compound', effect: 'Reduced insulation strength', cause: 'Degassing step skipped', severity: 6, occurrence: 3, detection: 3 },
      { op: 20, rowNo: '20.1', failureMode: 'Cure time too short', effect: 'Surface tackiness at assembly', cause: 'Timer not restarted after refill', severity: 5, occurrence: 3, detection: 4 },
    ],
    updatedDaysAgo: 4,
  },
  {
    aliases: ['Watlow Test Process 05', 'Terminal Crimp Preparation'],
    name: 'Terminal Crimp Preparation',
    status: 'DRAFT',
    site: 'Tychy',
    department: 'Production',
    products: ['TC-RED', 'TC-BLUE'],
    revisions: { draft: { pfd: 1, pfmea: 1, pcp: 0 } },
    comments: {
      pfd: 'Drafted prep flow for new crimp terminal family.',
      pfmea: 'Initial PFMEA rows added before PCP finalization.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Incorrect strip length', effect: 'Weak terminal retention', cause: 'Setup gauge not verified', severity: 6, occurrence: 4, detection: 4 },
      { op: 20, rowNo: '20.1', failureMode: 'Mixed terminal batch', effect: 'Wrong connector geometry', cause: 'Material presentation error', severity: 7, occurrence: 4, detection: 4 },
    ],
    updatedDaysAgo: 1,
  },
  {
    aliases: ['Watlow Test Process 06', 'Power Cable Routing'],
    name: 'Power Cable Routing',
    status: 'DRAFT',
    site: 'Berlin',
    department: 'Maintenance',
    products: ['PCR-1', 'PCR-2'],
    revisions: { draft: { pfd: 0, pfmea: 1, pcp: 0 } },
    comments: {
      pfmea: 'Pilot risks added for bend radius and clamp placement.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Cable bend radius too small', effect: 'Premature insulation damage', cause: 'Routing template outdated', severity: 8, occurrence: 4, detection: 5 },
      { op: 20, rowNo: '20.1', failureMode: 'Clamp not fully seated', effect: 'Cable movement in service', cause: 'Torque tool not recalibrated', severity: 7, occurrence: 4, detection: 6 },
    ],
    updatedDaysAgo: 5,
  },
  {
    aliases: ['Watlow Test Process 07', 'Export Packaging Validation'],
    name: 'Export Packaging Validation',
    status: 'OBSOLETE',
    site: 'Krakow',
    department: 'Quality',
    products: ['PKG-EU', 'PKG-US'],
    revisions: { open: { pfd: 1, pfmea: 1, pcp: 1 } },
    comments: {
      pfd: 'Superseded by consolidated export packaging route.',
      pfmea: 'Archived after packaging concept migration.',
      pcp: 'Legacy controls retained for audit traceability only.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Label mismatch', effect: 'Wrong export documentation', cause: 'Old template selected', severity: 6, occurrence: 3, detection: 4 },
    ],
    updatedDaysAgo: 12,
  },
  {
    aliases: ['Watlow Test Process 08', 'Thermostat Housing Review'],
    name: 'Thermostat Housing Review',
    status: 'OPEN',
    site: 'Berlin',
    department: 'Maintenance',
    products: ['THR-A', 'THR-B'],
    revisions: { open: { pfd: 3, pfmea: 2, pcp: 1 } },
    comments: {
      pfd: 'Merged maintenance loop into standard housing review path.',
      pfmea: 'Added deformation and sealing leak modes from service feedback.',
      pcp: 'Expanded dimensional checks after first field returns.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Housing deformation', effect: 'Seal leak during thermal cycle', cause: 'Press force too high', severity: 9, occurrence: 4, detection: 5 },
      { op: 20, rowNo: '20.1', failureMode: 'Missing gasket', effect: 'Ingress protection failure', cause: 'Kit presentation error', severity: 8, occurrence: 5, detection: 5 },
    ],
    updatedDaysAgo: 2,
  },
  {
    aliases: ['Watlow Test Process 09', 'Seal Inspection Pilot'],
    name: 'Seal Inspection Pilot',
    status: 'DRAFT',
    site: 'Poznan',
    department: 'Laboratory',
    products: ['SEAL-01', 'SEAL-02'],
    revisions: { draft: { pfd: 1, pfmea: 0, pcp: 0 } },
    comments: {
      pfd: 'Draft flow ready for pilot laboratory review.',
    },
    risks: [],
    updatedDaysAgo: 6,
  },
  {
    aliases: ['Watlow Test Process 10', 'Connector Weld Audit'],
    name: 'Connector Weld Audit',
    status: 'OPEN',
    site: 'Wroclaw',
    department: 'Production',
    products: ['CWA-10', 'CWA-20'],
    revisions: { open: { pfd: 2, pfmea: 2, pcp: 1 } },
    comments: {
      pfd: 'Updated weld audit checkpoints for connector family C.',
      pfmea: 'Added porosity and weak bond risk scenarios.',
      pcp: 'Inspection plan aligned with final weld acceptance criteria.',
    },
    risks: [
      { op: 10, rowNo: '10.1', failureMode: 'Porosity in weld seam', effect: 'Reduced electrical continuity', cause: 'Shielding gas flow unstable', severity: 8, occurrence: 5, detection: 6 },
      { op: 20, rowNo: '20.1', failureMode: 'Weak bond at connector tab', effect: 'Intermittent contact in operation', cause: 'Electrode wear beyond limit', severity: 9, occurrence: 4, detection: 6 },
    ],
    updatedDaysAgo: 3,
  },
]

function isoDaysAgo(daysAgo, extraHours = 0) {
  const dt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - extraHours * 60 * 60 * 1000)
  return dt.toISOString()
}

function buildRevisionLabel(rev) {
  return `${rev.pfd}.${rev.pfmea}.${rev.pcp}`
}

function computeDerived(row) {
  const oxd = row.occurrence * row.detection
  const rpn = row.severity * oxd
  return { oxd, rpn }
}

async function mustSingle(query, label) {
  const res = await query
  if (res.error) throw new Error(`${label}: ${res.error.message}`)
  if (!res.data) throw new Error(`${label}: no data`)
  return res.data
}

async function run() {
  const org = await mustSingle(
    supabase.from('organizations').select('id,name').ilike('name', orgName).maybeSingle(),
    'load org'
  )

  const membersRes = await supabase
    .from('organization_members')
    .select('user_id,role')
    .eq('organization_id', org.id)
    .eq('role', 'champion')
    .limit(1)
    .single()
  if (membersRes.error) throw new Error(`load champion: ${membersRes.error.message}`)

  const championUserId = membersRes.data.user_id
  const profileRes = await supabase
    .from('profiles')
    .select('first_name,last_name')
    .eq('id', championUserId)
    .maybeSingle()
  if (profileRes.error) throw new Error(`load champion profile: ${profileRes.error.message}`)
  const championName = [profileRes.data?.first_name, profileRes.data?.last_name].filter(Boolean).join(' ') || 'WATLOW Champion'

  const neededSiteDepts = [
    ['Tychy', 'Production'],
    ['Krakow', 'Engineering'],
    ['Krakow', 'Quality'],
    ['Berlin', 'Maintenance'],
    ['Poznan', 'Laboratory'],
    ['Wroclaw', 'Production'],
  ]

  const siteDeptRes = await supabase
    .from('site_departments')
    .select('id,site,department,active')
    .eq('organization_id', org.id)

  if (siteDeptRes.error) throw new Error(`load site_departments: ${siteDeptRes.error.message}`)

  const siteDeptMap = new Map((siteDeptRes.data ?? []).map((row) => [`${row.site}__${row.department}`, row.id]))

  for (const [site, department] of neededSiteDepts) {
    const key = `${site}__${department}`
    if (siteDeptMap.has(key)) continue
    const insertRes = await supabase
      .from('site_departments')
      .insert([{ organization_id: org.id, site, department, active: true }])
      .select('id,site,department')
      .single()
    if (insertRes.error) throw new Error(`insert site_department ${key}: ${insertRes.error.message}`)
    siteDeptMap.set(key, insertRes.data.id)
  }

  const allProjectsRes = await supabase
    .from('projects')
    .select('id,name,organization_id')
    .eq('organization_id', org.id)
  if (allProjectsRes.error) throw new Error(`load projects: ${allProjectsRes.error.message}`)
  const allProjects = allProjectsRes.data ?? []

  const templatePfmeaRes = await supabase
    .from('pfmea_rows')
    .select('*')
    .limit(1)
    .single()
  if (templatePfmeaRes.error) throw new Error(`load pfmea template: ${templatePfmeaRes.error.message}`)
  const pfmeaTemplate = templatePfmeaRes.data

  const summary = []

  for (const spec of demoProjects) {
    const project =
      allProjects.find((row) => spec.aliases.includes(row.name)) ??
      allProjects.find((row) => row.name === spec.name)

    if (!project) {
      summary.push({ name: spec.name, status: 'SKIPPED', reason: 'Project not found' })
      continue
    }

    const siteDeptId = siteDeptMap.get(`${spec.site}__${spec.department}`)
    if (!siteDeptId) throw new Error(`Missing site_department ${spec.site}/${spec.department}`)

    await supabase
      .from('projects')
      .update({
        current_open_revision_id: null,
        current_draft_revision_id: null,
      })
      .eq('id', project.id)

    await supabase.from('pfd_change_history').delete().eq('project_id', project.id)
    await supabase.from('pfmea_change_history').delete().eq('project_id', project.id)
    await supabase.from('pcp_change_history').delete().eq('project_id', project.id)
    await supabase.from('process_revisions').delete().eq('project_id', project.id)

    const existingOps = await supabase.from('operations').select('id').eq('project_id', project.id)
    if (existingOps.error) throw new Error(`load operations for ${spec.name}: ${existingOps.error.message}`)
    const opIds = (existingOps.data ?? []).map((row) => row.id)
    if (opIds.length) {
      await supabase.from('pfmea_rows').delete().in('operation_id', opIds)
      await supabase.from('operations').delete().eq('project_id', project.id)
    }

    const openRevisionId = spec.revisions.open ? randomUUID() : null
    const draftRevisionId = spec.revisions.draft ? randomUUID() : null

    if (spec.revisions.open) {
      const openRev = {
        id: openRevisionId,
        project_id: project.id,
        pfd_rev: spec.revisions.open.pfd,
        pfmea_rev: spec.revisions.open.pfmea,
        pcp_rev: spec.revisions.open.pcp,
        revision_status: 'OPEN',
        based_on_revision_id: null,
        change_description: spec.comments.pfmea ?? spec.comments.pfd ?? 'Open revision',
        created_by: championUserId,
        created_at: isoDaysAgo(spec.updatedDaysAgo, 2),
      }
      const insertOpen = await supabase.from('process_revisions').insert([openRev])
      if (insertOpen.error) throw new Error(`insert open revision for ${spec.name}: ${insertOpen.error.message}`)
    }

    if (spec.revisions.draft) {
      const draftRev = {
        id: draftRevisionId,
        project_id: project.id,
        pfd_rev: spec.revisions.draft.pfd,
        pfmea_rev: spec.revisions.draft.pfmea,
        pcp_rev: spec.revisions.draft.pcp,
        revision_status: 'DRAFT',
        based_on_revision_id: openRevisionId,
        change_description: spec.comments.pfmea ?? spec.comments.pfd ?? 'Draft revision',
        created_by: championUserId,
        created_at: isoDaysAgo(spec.updatedDaysAgo, 1),
      }
      const insertDraft = await supabase.from('process_revisions').insert([draftRev])
      if (insertDraft.error) throw new Error(`insert draft revision for ${spec.name}: ${insertDraft.error.message}`)
    }

    const projectUpdate = {
      name: spec.name,
      site_department_id: siteDeptId,
      status: spec.status,
      products: spec.products.join(', '),
      standard: 'GENERIC',
      updated_by: championUserId,
      updated_at: isoDaysAgo(spec.updatedDaysAgo),
      current_open_revision_id: openRevisionId,
      current_draft_revision_id: draftRevisionId,
      user_id: championUserId,
    }
    const updateProject = await supabase.from('projects').update(projectUpdate).eq('id', project.id)
    if (updateProject.error) throw new Error(`update project ${spec.name}: ${updateProject.error.message}`)

    const op1Id = randomUUID()
    const op2Id = randomUUID()
    const opRows = [
      {
        id: op1Id,
        project_id: project.id,
        operation_number: 10,
        name: 'Preparation',
        machine: `${spec.site} Cell A`,
        operation: 'Prepare material and verify setup',
        active: true,
        created_at: isoDaysAgo(spec.updatedDaysAgo, 4),
      },
      {
        id: op2Id,
        project_id: project.id,
        operation_number: 20,
        name: 'Execution',
        machine: `${spec.site} Cell B`,
        operation: 'Run main process and final verification',
        active: true,
        created_at: isoDaysAgo(spec.updatedDaysAgo, 4),
      },
    ]
    const insertOps = await supabase.from('operations').insert(opRows)
    if (insertOps.error) throw new Error(`insert operations for ${spec.name}: ${insertOps.error.message}`)

    const workingRevisionId = draftRevisionId ?? openRevisionId
    if (workingRevisionId && spec.risks.length) {
      const pfmeaPayload = spec.risks.map((risk, riskIndex) => {
        const opId = risk.op === 10 ? op1Id : op2Id
        const derived = computeDerived(risk)
        return {
          ...pfmeaTemplate,
          id: randomUUID(),
          operation_id: opId,
          revision_id: workingRevisionId,
          process: spec.name,
          row_no: risk.rowNo,
          failure_mode_group_id: randomUUID(),
          failure_block_group_id: randomUUID(),
          action_plan_group_id: randomUUID(),
          failure_mode: risk.failureMode,
          effect: risk.effect,
          cause: risk.cause,
          severity: risk.severity,
          occurrence: risk.occurrence,
          detection: risk.detection,
          oxd: derived.oxd,
          rpn: derived.rpn,
          oxd_current: derived.oxd,
          rpn_current: derived.rpn,
          current_prevention: `Standard work for ${spec.site} setup verification`,
          current_detection: `Final check by ${spec.department} reviewer`,
          recommended_action: risk.severity >= 8 ? 'Add poka-yoke or tighten setup verification.' : 'Review work instruction and confirm control point.',
          responsible: championName,
          target_date: isoDaysAgo(-14 + riskIndex).slice(0, 10),
          action_status: risk.severity >= 8 ? 'OPEN' : 'IN PROGRESS',
          status: 'OPEN',
          status2: null,
          status_final: risk.severity >= 8 ? 'OPEN' : 'MONITORED',
          actions_taken: '',
          updated_at: isoDaysAgo(spec.updatedDaysAgo),
          created_at: isoDaysAgo(spec.updatedDaysAgo, 3 + riskIndex),
          severity2: null,
          occurrence2: null,
          detection2: null,
          rpn2: null,
          oxd2: null,
          characteristic: risk.severity >= 8 ? 'SC' : null,
          pcp: true,
          class: risk.severity >= 8 ? 'CC' : null,
        }
      })
      const insertPfmea = await supabase.from('pfmea_rows').insert(pfmeaPayload)
      if (insertPfmea.error) throw new Error(`insert pfmea rows for ${spec.name}: ${insertPfmea.error.message}`)
    }

    const historyRows = []
    if (spec.comments.pfd) {
      historyRows.push({
        table: 'pfd_change_history',
        row: {
          project_id: project.id,
          revision_label: buildRevisionLabel(spec.revisions.draft ?? spec.revisions.open),
          change_description: spec.comments.pfd,
          author_id: championUserId,
          author_name: championName,
          node_count: 6,
          created_at: isoDaysAgo(spec.updatedDaysAgo, 3),
        },
      })
    }
    if (spec.comments.pfmea) {
      historyRows.push({
        table: 'pfmea_change_history',
        row: {
          project_id: project.id,
          revision_label: buildRevisionLabel(spec.revisions.draft ?? spec.revisions.open),
          change_description: spec.comments.pfmea,
          author_id: championUserId,
          author_name: championName,
          risk_count: spec.risks.length,
          avg_rpn: spec.risks.length ? Number((spec.risks.reduce((sum, risk) => sum + computeDerived(risk).rpn, 0) / spec.risks.length).toFixed(1)) : null,
          created_at: isoDaysAgo(spec.updatedDaysAgo, 2),
        },
      })
    }
    if (spec.comments.pcp) {
      historyRows.push({
        table: 'pcp_change_history',
        row: {
          project_id: project.id,
          revision_label: buildRevisionLabel(spec.revisions.draft ?? spec.revisions.open),
          change_description: spec.comments.pcp,
          author_id: championUserId,
          author_name: championName,
          control_count: Math.max(spec.risks.length, 1),
          created_at: isoDaysAgo(spec.updatedDaysAgo, 1),
        },
      })
    }

    for (const item of historyRows) {
      const ins = await supabase.from(item.table).insert([item.row])
      if (ins.error) throw new Error(`insert ${item.table} for ${spec.name}: ${ins.error.message}`)
    }

    summary.push({
      name: spec.name,
      status: spec.status,
      revision: buildRevisionLabel(spec.revisions.draft ?? spec.revisions.open),
      site: spec.site,
      department: spec.department,
      riskCount: spec.risks.length,
    })
  }

  const verifyProjects = await supabase
    .from('projects_with_revision')
    .select('name,status,open_revision_label,draft_revision_label')
    .eq('organization_id', org.id)
    .in('name', demoProjects.map((project) => project.name))
    .order('name')

  if (verifyProjects.error) throw new Error(`verify projects: ${verifyProjects.error.message}`)

  console.log(JSON.stringify({
    ok: true,
    organization: org.name,
    updatedProjects: summary,
    verification: verifyProjects.data,
  }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
