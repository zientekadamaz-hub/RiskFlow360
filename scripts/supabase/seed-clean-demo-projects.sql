begin;

set local statement_timeout = '60s';

create temp table seed_context on commit drop as
select
  o.id as organization_id,
  om.user_id as author_id,
  coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.email, 'RiskFlow Champion') as author_name
from public.organizations o
join public.organization_members om on om.organization_id = o.id
left join public.profiles p on p.id = om.user_id
where o.name = 'WATLOW'
  and om.role::text = 'champion'
order by (p.email = 'riskflow360@gmail.com') desc, p.created_at asc
limit 1;

do $$
begin
  if not exists (select 1 from seed_context) then
    raise exception 'Cannot seed demo projects: organization WATLOW with champion member was not found.';
  end if;
end $$;

create temp table seed_projects (
  project_key text primary key,
  name text not null,
  site text not null,
  department text not null,
  products text not null,
  pfd_rev integer not null,
  pfmea_rev integer not null,
  pcp_rev integer not null,
  description text not null,
  created_days_ago integer not null
) on commit drop;

insert into seed_projects(project_key, name, site, department, products, pfd_rev, pfmea_rev, pcp_rev, description, created_days_ago)
values
  ('tire', 'Tire Replacement Service', 'Wroclaw', 'Production', 'Passenger car tire service, wheel balancing', 1, 1, 1, 'Clean demo process with cascaded PFMEA structure for tire replacement.', 5),
  ('heater', 'Cartridge Heater Assembly', 'Wroclaw', 'Production', 'CH-240V, CH-480V', 1, 1, 1, 'Clean demo process for PFMEA summary, closed actions and RPN reports.', 4),
  ('sensor', 'Sensor Lead Brazing', 'Krakow', 'Engineering', 'TC-SLIM, RTD-PRO', 1, 1, 1, 'Clean demo process for mixed current and residual risk validation.', 3);

create temp table seed_project_ids on commit drop as
select p.id
from public.projects p
join seed_projects sp on sp.name = p.name
where p.organization_id = (select organization_id from seed_context);

create temp table seed_revision_ids on commit drop as
select pr.id
from public.process_revisions pr
where pr.project_id in (select id from seed_project_ids);

create temp table seed_operation_ids on commit drop as
select op.id
from public.operations op
where op.project_id in (select id from seed_project_ids);

create temp table seed_pfmea_row_ids on commit drop as
select r.id
from public.pfmea_rows r
where r.revision_id in (select id from seed_revision_ids)
   or r.operation_id in (select id from seed_operation_ids);

create temp table seed_pfd_node_ids on commit drop as
select n.id
from public.pfd_nodes n
where n.revision_id in (select id from seed_revision_ids)
   or n.operation_id in (select id from seed_operation_ids);

update public.projects
set current_open_revision_id = null,
    current_draft_revision_id = null
where id in (select id from seed_project_ids);

update public.process_revisions
set based_on_revision_id = null
where id in (select id from seed_revision_ids)
   or based_on_revision_id in (select id from seed_revision_ids);

delete from public.pfd_edges
where revision_id in (select id from seed_revision_ids)
   or source_node_id in (select id from seed_pfd_node_ids)
   or target_node_id in (select id from seed_pfd_node_ids);

delete from public.control_plan_rows
where revision_id in (select id from seed_revision_ids)
   or operation_id in (select id from seed_operation_ids)
   or pfmea_row_id in (select id from seed_pfmea_row_ids);

delete from public.pfd_nodes where id in (select id from seed_pfd_node_ids);
delete from public.pfd_diagrams where project_id in (select id from seed_project_ids);
delete from public.pfd_drafts where project_id in (select id from seed_project_ids);
delete from public.pfd_session_events where project_id in (select id from seed_project_ids);
delete from public.pfd_edit_sessions where project_id in (select id from seed_project_ids);
delete from public.pfd_change_history where project_id in (select id from seed_project_ids);
delete from public.pfmea_edit_sessions where project_id in (select id from seed_project_ids);
delete from public.pfmea_change_history where project_id in (select id from seed_project_ids);
delete from public.pcp_edit_sessions where project_id in (select id from seed_project_ids);
delete from public.pcp_change_history where project_id in (select id from seed_project_ids);
delete from public.customer_access_grants where project_id in (select id from seed_project_ids);
delete from public.pfmea_rows where id in (select id from seed_pfmea_row_ids);
delete from public.process_revisions where id in (select id from seed_revision_ids);
delete from public.operations where id in (select id from seed_operation_ids);
delete from public.projects where id in (select id from seed_project_ids);

insert into public.site_departments(organization_id, site, department, active)
select distinct
  (select organization_id from seed_context),
  sp.site,
  sp.department,
  true
from seed_projects sp
where not exists (
  select 1
  from public.site_departments sd
  where sd.organization_id = (select organization_id from seed_context)
    and sd.site = sp.site
    and sd.department = sp.department
);

insert into public.projects(
  organization_id,
  site_department_id,
  user_id,
  name,
  standard,
  status,
  products,
  updated_by,
  created_at,
  updated_at
)
select
  (select organization_id from seed_context),
  sd.id,
  (select author_id from seed_context),
  sp.name,
  'GENERIC',
  'OPEN',
  sp.products,
  (select author_id from seed_context),
  now() - make_interval(days => sp.created_days_ago),
  now() - make_interval(days => greatest(sp.created_days_ago - 1, 0))
from seed_projects sp
join public.site_departments sd
  on sd.organization_id = (select organization_id from seed_context)
 and sd.site = sp.site
 and sd.department = sp.department;

create temp table seed_project_map on commit drop as
select sp.project_key, sp.name, p.id as project_id, sp.pfd_rev, sp.pfmea_rev, sp.pcp_rev, sp.description
from seed_projects sp
join public.projects p
  on p.organization_id = (select organization_id from seed_context)
 and p.name = sp.name;

insert into public.process_revisions(
  project_id,
  pfd_rev,
  pfmea_rev,
  pcp_rev,
  change_description,
  created_by,
  revision_status,
  created_at
)
select
  spm.project_id,
  spm.pfd_rev,
  spm.pfmea_rev,
  spm.pcp_rev,
  spm.description,
  (select author_id from seed_context),
  'OPEN',
  now() - interval '2 days'
from seed_project_map spm;

create temp table seed_revision_map on commit drop as
select spm.project_key, pr.id as revision_id
from seed_project_map spm
join public.process_revisions pr on pr.project_id = spm.project_id
where pr.revision_status = 'OPEN';

update public.projects p
set current_open_revision_id = srm.revision_id,
    current_draft_revision_id = null
from seed_project_map spm
join seed_revision_map srm on srm.project_key = spm.project_key
where p.id = spm.project_id;

create temp table seed_operations (
  project_key text not null,
  operation_number integer not null,
  name text not null,
  machine text not null,
  operation text not null
) on commit drop;

insert into seed_operations(project_key, operation_number, name, machine, operation)
values
  ('tire', 10, 'Vehicle intake and lift', 'Service bay 1', 'Confirm vehicle, select lift points and raise vehicle.'),
  ('tire', 20, 'Wheel removal', 'Service bay 1', 'Remove wheel nuts and inspect wheel/hub condition.'),
  ('tire', 30, 'Tire mounting and balancing', 'Mounting station', 'Replace tire, seat bead and balance wheel.'),
  ('tire', 40, 'Final torque and release', 'Service bay 1', 'Torque wheels, set pressure and perform final safety check.'),
  ('heater', 10, 'Winding preparation', 'Wroclaw Cell A', 'Prepare winding, insulation and terminal setup.'),
  ('heater', 20, 'Assembly verification', 'Wroclaw Cell B', 'Verify connector, torque and electrical continuity.'),
  ('sensor', 10, 'Lead preparation', 'Krakow Brazing Cell', 'Prepare lead wire, fixture and heat profile.'),
  ('sensor', 20, 'Brazing and inspection', 'Krakow Brazing Cell', 'Braze lead and inspect wetting/alignment.');

insert into public.operations(project_id, operation_number, name, machine, operation, active, created_at)
select
  spm.project_id,
  so.operation_number,
  so.name,
  so.machine,
  so.operation,
  true,
  now() - interval '2 days'
from seed_operations so
join seed_project_map spm on spm.project_key = so.project_key
order by spm.name, so.operation_number;

create temp table seed_operation_map on commit drop as
select spm.project_key, op.id as operation_id, op.project_id, op.operation_number, op.name, op.machine, op.operation
from seed_project_map spm
join public.operations op on op.project_id = spm.project_id;

create temp table seed_risks (
  project_key text not null,
  operation_number integer not null,
  seq integer not null,
  row_no text not null,
  fm_code text not null,
  fb_code text not null,
  risk_code text not null,
  failure_mode text not null,
  characteristic text,
  class text,
  effect text not null,
  severity integer not null,
  cause text not null,
  occurrence integer not null,
  current_prevention text not null,
  current_detection text not null,
  detection integer not null,
  pcp boolean not null,
  recommended_action text not null,
  responsible text not null,
  target_offset_days integer,
  action_status text,
  occurrence_after integer,
  detection_after integer
) on commit drop;

insert into seed_risks(project_key, operation_number, seq, row_no, fm_code, fb_code, risk_code, failure_mode, characteristic, class, effect, severity, cause, occurrence, current_prevention, current_detection, detection, pcp, recommended_action, responsible, target_offset_days, action_status, occurrence_after, detection_after)
values
  ('tire', 10, 1, '10.1.1.1.1', 'tire-fm-wheel-safe', 'tire-fb-wheel-loose', 'tire-risk-lift', 'Wheel assembly unsafe after service', 'Safety critical service characteristic', 'CC', 'Wheel loosening in service', 10, 'Vehicle lifted at incorrect support point causing unstable work position', 3, 'Lift-point check in service order', 'Technician peer check before wheel removal', 4, true, 'Add lift-point photo confirmation before wheel removal.', 'Oliwia Zientek', 14, 'OPEN', null, null),
  ('tire', 20, 2, '20.1.1.2.1', 'tire-fm-wheel-safe', 'tire-fb-wheel-loose', 'tire-risk-torque', 'Wheel assembly unsafe after service', 'Safety critical service characteristic', 'CC', 'Wheel loosening in service', 10, 'Wheel nuts under-torqued during final installation', 4, 'Torque specification visible at bay', 'Final torque audit after wheel installation', 7, true, 'Use torque wrench lockout and second signature for final torque.', 'Oliwia Zientek', 10, 'OPEN', null, null),
  ('tire', 30, 3, '30.1.2.1.1', 'tire-fm-wheel-safe', 'tire-fb-air-loss', 'tire-risk-bead', 'Wheel assembly unsafe after service', 'Pressure retention', 'SC', 'Rapid air loss after release', 9, 'Bead not seated correctly after tire mounting', 2, 'Bead lubrication standard work', 'Leak test after inflation', 5, true, 'Add automatic pressure hold timer before release.', 'Oliwia Zientek', 18, 'OPEN', null, null),
  ('tire', 30, 4, '30.2.1.1.1', 'tire-fm-direction', 'tire-fb-grip', 'tire-risk-direction', 'Directional tire installed incorrectly', 'Tread direction', null, 'Poor wet grip and increased stopping distance', 8, 'Rotation arrow not verified before mounting', 4, 'Direction arrow visual check', 'Final visual inspection', 3, true, 'Add directional tire checklist to mounting station.', 'Oliwia Zientek', 21, 'OPEN', null, null),
  ('tire', 40, 5, '40.1.1.1.1', 'tire-fm-vibration', 'tire-fb-vibration', 'tire-risk-balance', 'Wheel not balanced correctly', 'Ride comfort', null, 'Vehicle vibration at speed', 5, 'Balancer calibration drift not detected', 4, 'Daily balancer check', 'Road-force value review', 4, true, 'Record balancer calibration result in release checklist.', 'Oliwia Zientek', 28, 'OPEN', null, null),

  ('heater', 10, 1, '10.1.1.1.1', 'heater-fm-no-heat', 'heater-fb-no-output', 'heater-risk-winding', 'No heat output at startup', 'Electrical output', 'CC', 'Customer startup failure', 9, 'Insulation nick during winding', 7, 'Standard work for Wroclaw setup verification', 'Final check by production reviewer', 8, true, 'Add poka-yoke or tighten setup verification.', 'Oliwia Zientek', -10, 'CLOSED', 9, 1),
  ('heater', 10, 2, '10.2.1.1.1', 'heater-fm-no-heat-2', 'heater-fb-no-output-2', 'heater-risk-connector', 'No heat output at startup', 'Connector continuity', 'CC', 'Customer startup failure', 9, 'Connector pin not seated', 10, 'Connector seating standard', 'Continuity check after assembly', 8, true, 'Add seating gauge before continuity test.', 'Oliwia Zientek', -4, 'CLOSED', 1, 1),
  ('heater', 10, 3, '10.3.1.1.1', 'heater-fm-terminal', 'heater-fb-terminal', 'heater-risk-torque-low', 'Terminal torque outside limit', 'Terminal torque', 'CC', 'Intermittent electrical contact', 9, 'Torque driver setup not confirmed', 10, 'Torque specification at workstation', 'Final torque audit', 1, true, 'Add torque tool setup verification.', 'Oliwia Zientek', 12, 'OPEN', null, null),
  ('heater', 10, 4, '10.4.1.1.1', 'heater-fm-label', 'heater-fb-label', 'heater-risk-label', 'Incorrect product label applied', 'Traceability', null, 'Wrong rating visible to customer', 9, 'Label batch mixed at workstation', 2, 'Label bin separation', 'Label scan before pack', 4, true, 'Add label scan interlock.', 'Oliwia Zientek', 16, 'OPEN', null, null),
  ('heater', 20, 5, '20.1.1.1.1', 'heater-fm-scratch', 'heater-fb-scratch', 'heater-risk-scratch', 'Cosmetic scratch on sheath', 'Surface appearance', null, 'Cosmetic nonconformance', 9, 'Part dragged across fixture edge', 1, 'Fixture edge protection', 'Visual inspection', 1, true, 'Review fixture edge cover.', 'Oliwia Zientek', 20, 'OPEN', null, null),
  ('heater', 20, 6, '20.2.1.1.1', 'heater-fm-overheat', 'heater-fb-overheat', 'heater-risk-overheat', 'Connector overheats in service', 'Thermal safety', 'CC', 'Field overheating complaint', 9, 'Crimp compression below limit', 9, 'Crimp tool verification', 'Pull test and visual inspection', 10, true, 'Add crimp force trend review.', 'Oliwia Zientek', -8, 'CLOSED', 8, 3),
  ('heater', 20, 7, '20.3.1.1.1', 'heater-fm-cable-route', 'heater-fb-cable-route', 'heater-risk-route', 'Cable route too close to hot surface', 'Thermal clearance', 'CC', 'Cable insulation degradation', 8, 'Routing template not followed', 6, 'Routing template at station', 'Final cable clearance check', 7, true, 'Add clearance gauge to final inspection.', 'Oliwia Zientek', 9, 'OPEN', null, null),

  ('sensor', 10, 1, '10.1.1.1.1', 'sensor-fm-cold-braze', 'sensor-fb-signal', 'sensor-risk-profile', 'Cold braze joint', 'Signal continuity', 'CC', 'Signal interruption in temperature loop', 9, 'Insufficient heat profile', 5, 'Brazing heat profile recipe', 'Visual wetting inspection', 6, true, 'Lock profile selection to product family.', 'Oliwia Zientek', -6, 'CLOSED', 2, 3),
  ('sensor', 20, 2, '20.1.1.1.1', 'sensor-fm-lead-align', 'sensor-fb-rework', 'sensor-risk-fixture', 'Lead misalignment', 'Lead geometry', null, 'Assembly rework required', 7, 'Fixture pin wear', 5, 'Fixture changeover check', 'Lead alignment inspection', 5, true, 'Add pin wear visual limit sample.', 'Oliwia Zientek', 17, 'OPEN', null, null),
  ('sensor', 20, 3, '20.2.1.1.1', 'sensor-fm-contamination', 'sensor-fb-contamination', 'sensor-risk-flux', 'Flux contamination remains after brazing', 'Cleanliness', null, 'Contamination found during final assembly', 6, 'Cleaning time shortened after rework', 2, 'Cleaning time standard', 'Final cleanliness check', 5, true, 'Add rework cleaning confirmation.', 'Oliwia Zientek', 19, 'OPEN', null, null);

create temp table seed_group_ids on commit drop as
select project_key, 'fm' as group_type, fm_code as group_code, gen_random_uuid() as group_id
from (select distinct project_key, fm_code from seed_risks) x
union all
select project_key, 'fb' as group_type, fb_code as group_code, gen_random_uuid() as group_id
from (select distinct project_key, fb_code from seed_risks) x
union all
select project_key, 'risk' as group_type, risk_code as group_code, gen_random_uuid() as group_id
from (select distinct project_key, risk_code from seed_risks) x;

insert into public.pfmea_rows(
  operation_id,
  revision_id,
  process,
  row_no,
  failure_mode_group_id,
  failure_block_group_id,
  action_plan_group_id,
  failure_mode,
  characteristic,
  class,
  effect,
  severity,
  cause,
  occurrence,
  current_prevention,
  current_detection,
  detection,
  oxd,
  rpn,
  pcp,
  recommended_action,
  responsible,
  target_date,
  action_status,
  occurrence2,
  detection2,
  oxd2,
  rpn2,
  oxd_current,
  rpn_current,
  status,
  status2,
  status_final,
  actions_taken,
  created_at,
  updated_at
)
select
  som.operation_id,
  srm.revision_id,
  spm.name,
  sr.row_no,
  fm.group_id,
  fb.group_id,
  rg.group_id,
  sr.failure_mode,
  coalesce(sr.characteristic, ''),
  sr.class,
  sr.effect,
  sr.severity,
  sr.cause,
  sr.occurrence,
  sr.current_prevention,
  sr.current_detection,
  sr.detection,
  sr.occurrence * sr.detection,
  sr.severity * sr.occurrence * sr.detection,
  sr.pcp,
  sr.recommended_action,
  sr.responsible,
  case when sr.target_offset_days is null then null else current_date + sr.target_offset_days end,
  sr.action_status,
  sr.occurrence_after,
  sr.detection_after,
  case when sr.occurrence_after is null or sr.detection_after is null then null else sr.occurrence_after * sr.detection_after end,
  case when sr.occurrence_after is null or sr.detection_after is null then null else sr.severity * sr.occurrence_after * sr.detection_after end,
  case
    when upper(coalesce(sr.action_status, '')) = 'CLOSED' and sr.occurrence_after is not null and sr.detection_after is not null
      then sr.occurrence_after * sr.detection_after
    else sr.occurrence * sr.detection
  end,
  case
    when upper(coalesce(sr.action_status, '')) = 'CLOSED' and sr.occurrence_after is not null and sr.detection_after is not null
      then sr.severity * sr.occurrence_after * sr.detection_after
    else sr.severity * sr.occurrence * sr.detection
  end,
  'OPEN',
  null,
  case when upper(coalesce(sr.action_status, '')) = 'CLOSED' then 'MONITORED' else 'OPEN' end,
  '',
  now() - interval '1 day' + (sr.seq * interval '1 minute'),
  now() - interval '1 hour' + (sr.seq * interval '1 minute')
from seed_risks sr
join seed_project_map spm on spm.project_key = sr.project_key
join seed_revision_map srm on srm.project_key = sr.project_key
join seed_operation_map som on som.project_key = sr.project_key and som.operation_number = sr.operation_number
join seed_group_ids fm on fm.project_key = sr.project_key and fm.group_type = 'fm' and fm.group_code = sr.fm_code
join seed_group_ids fb on fb.project_key = sr.project_key and fb.group_type = 'fb' and fb.group_code = sr.fb_code
join seed_group_ids rg on rg.project_key = sr.project_key and rg.group_type = 'risk' and rg.group_code = sr.risk_code
order by spm.name, sr.seq;

create temp table seed_pfmea_row_map on commit drop as
select
  sr.project_key,
  sr.row_no,
  r.id as pfmea_row_id,
  r.risk_uid,
  r.operation_id,
  r.revision_id,
  r.failure_mode,
  r.characteristic,
  r.class,
  r.current_prevention,
  r.current_detection,
  r.recommended_action
from seed_risks sr
join seed_revision_map srm on srm.project_key = sr.project_key
join seed_operation_map som on som.project_key = sr.project_key and som.operation_number = sr.operation_number
join public.pfmea_rows r
  on r.revision_id = srm.revision_id
 and r.operation_id = som.operation_id
 and r.row_no = sr.row_no;

insert into public.control_plan_rows(
  operation_id,
  revision_id,
  risk_uid,
  pfmea_row_id,
  characteristic,
  failure_mode,
  class,
  current_prevention,
  current_detection,
  control_method,
  frequency,
  reaction_plan,
  sample_size,
  source,
  status,
  created_at,
  updated_at
)
select
  r.operation_id,
  r.revision_id,
  r.risk_uid,
  r.pfmea_row_id,
  coalesce(nullif(r.characteristic, ''), r.failure_mode),
  r.failure_mode,
  r.class,
  r.current_prevention,
  r.current_detection,
  r.current_detection,
  'Every batch',
  coalesce(nullif(r.recommended_action, ''), 'Escalate to process owner and contain suspect product.'),
  '5 pcs',
  'AUTO',
  'OK',
  now() - interval '1 day',
  now() - interval '1 hour'
from (
  select distinct on (revision_id, risk_uid)
    *
  from seed_pfmea_row_map
  order by revision_id, risk_uid, row_no
) r
on conflict do nothing;

insert into public.pfd_diagrams(project_id, nodes, edges, updated_at)
select
  node_data.project_id,
  node_data.nodes,
  coalesce(edge_data.edges, '[]'::jsonb),
  now() - interval '1 hour'
from (
  select
    som.project_id,
    jsonb_agg(
      jsonb_build_object(
        'id', som.operation_id::text,
        'type', 'operation',
        'position', jsonb_build_object('x', 170, 'y', 170 + ((som.row_number - 1) * 190)),
        'data', jsonb_build_object(
          'kind', 'operation',
          'name', som.name,
          'opNo', som.operation_number,
          'station', som.machine,
          'operation', som.operation
        )
      )
      order by som.operation_number
    ) as nodes
  from (
    select *, row_number() over (partition by project_key order by operation_number) as row_number
    from seed_operation_map
  ) som
  group by som.project_id
) node_data
left join (
  select
    edges.project_id,
    jsonb_agg(
      jsonb_build_object(
        'id', 'e-' || edges.operation_id::text || '-bottom-' || edges.next_operation_id::text || '-top-seed',
        'source', edges.operation_id::text,
        'sourceHandle', 'bottom-s',
        'target', edges.next_operation_id::text,
        'targetHandle', 'top-t',
        'type', 'smoothedit',
        'pathOptions', jsonb_build_object('borderRadius', 14, 'offset', 15),
        'markerEnd', jsonb_build_object('type', 'arrowclosed', 'width', 26, 'height', 18, 'color', '#dbe7f5'),
        'style', jsonb_build_object('strokeWidth', 1, 'stroke', '#dbe7f5')
      )
      order by edges.operation_number
    ) as edges
  from (
    select
      project_id,
      operation_number,
      operation_id,
      lead(operation_id) over (partition by project_key order by operation_number) as next_operation_id
    from seed_operation_map
  ) edges
  where edges.next_operation_id is not null
  group by edges.project_id
) edge_data on edge_data.project_id = node_data.project_id;

create temp table seed_project_metrics on commit drop as
select
  spm.project_key,
  spm.project_id,
  spm.pfd_rev || '.' || spm.pfmea_rev || '.' || spm.pcp_rev as revision_label,
  count(r.id)::integer as risk_count,
  round(avg(
    case
      when upper(coalesce(r.action_status, '')) = 'CLOSED' and r.occurrence2 is not null and r.detection2 is not null
        then r.severity * r.occurrence2 * r.detection2
      else r.severity * r.occurrence * r.detection
    end
  )::numeric, 1) as avg_rpn
from seed_project_map spm
join seed_revision_map srm on srm.project_key = spm.project_key
left join public.pfmea_rows r on r.revision_id = srm.revision_id
group by spm.project_key, spm.project_id, spm.pfd_rev, spm.pfmea_rev, spm.pcp_rev;

insert into public.pfd_change_history(project_id, revision_label, change_description, author_id, author_name, node_count, edge_count, created_at)
select
  spm.project_id,
  m.revision_label,
  spm.description,
  (select author_id from seed_context),
  (select author_name from seed_context),
  (select count(*) from seed_operation_map som where som.project_key = spm.project_key),
  greatest((select count(*) - 1 from seed_operation_map som where som.project_key = spm.project_key), 0),
  now() - interval '2 days'
from seed_project_map spm
join seed_project_metrics m on m.project_key = spm.project_key;

insert into public.pcp_change_history(project_id, revision_label, change_description, author_id, author_name, control_count, created_at)
select
  spm.project_id,
  m.revision_label,
  'Initial control plan generated from clean PFMEA demo rows.',
  (select author_id from seed_context),
  (select author_name from seed_context),
  m.risk_count,
  now() - interval '1 day'
from seed_project_map spm
join seed_project_metrics m on m.project_key = spm.project_key;

insert into public.pfmea_change_history(project_id, revision_label, change_description, author_id, author_name, risk_count, avg_rpn, created_at)
select
  m.project_id,
  m.revision_label,
  case
    when series.day_no = 1 then 'Current clean PFMEA demo baseline.'
    else 'Seeded historical PFMEA trend point.'
  end,
  (select author_id from seed_context),
  (select author_name from seed_context),
  m.risk_count,
  round((m.avg_rpn + (series.day_no * 2.1))::numeric, 1),
  now() - make_interval(days => series.day_no)
from seed_project_metrics m
cross join generate_series(30, 1, -1) as series(day_no);

commit;

select
  p.name,
  p.status,
  coalesce(sd.site, '') as site,
  coalesce(sd.department, '') as department,
  (select count(*) from public.operations op where op.project_id = p.id and op.active = true) as operations,
  (select count(*) from public.pfmea_rows r where r.revision_id = p.current_open_revision_id) as pfmea_rows,
  (select count(*) from public.control_plan_rows cpr where cpr.revision_id = p.current_open_revision_id) as pcp_rows,
  (
    select round(avg(
      case
        when upper(coalesce(r.action_status, '')) = 'CLOSED' and r.occurrence2 is not null and r.detection2 is not null
          then r.severity * r.occurrence2 * r.detection2
        else r.severity * r.occurrence * r.detection
      end
    )::numeric, 1)
    from public.pfmea_rows r
    where r.revision_id = p.current_open_revision_id
  ) as avg_current_rpn
from public.projects p
left join public.site_departments sd on sd.id = p.site_department_id
where p.organization_id = (select id from public.organizations where name = 'WATLOW' limit 1)
  and p.name in ('Tire Replacement Service', 'Cartridge Heater Assembly', 'Sensor Lead Brazing')
order by p.name;
