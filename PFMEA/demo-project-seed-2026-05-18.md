# Clean Demo Projects Seed - 2026-05-18

## Scope

After clearing project-operational test data, three clean demo projects were created in the `WATLOW` organization.

## Created Projects

| Project | Site | Department | Operations | PFMEA risks | PCP rows | Effective average RPN |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Cartridge Heater Assembly | Wroclaw | Production | 2 | 7 | 3 | 116.1 |
| Sensor Lead Brazing | Krakow | Engineering | 2 | 3 | 2 | 96.3 |
| Tire Replacement Service | Wroclaw | Production | 4 | 5 | 4 | 133.2 |

## Report Baseline

Across the three demo projects:

- Open PFMEA risks: 15
- Effective average RPN: 117.9
- Risk color split using current WATLOW thresholds:
  - Green: 2
  - Yellow: 9
  - Orange: 2
  - Red: 2
- PFMEA history points for Progress Chart: 90
- History range: 2026-04-18 to 2026-05-17

## Notes

- The seed is idempotent and can be rerun from `scripts/supabase/seed-clean-demo-projects.sql`.
- The seed deletes and recreates only these three demo projects by name.
- Closed actions are interpreted by recalculating risk from `occurrence2` and `detection2`.
- PCP rows respect the database rule of one automatic control row per `operation_id + characteristic`.

## Validation

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run regression:pfmea-report-risk`: passed
- `npm run regression:progress-chart-service`: passed
- `npm run regression:shared`: passed
- `npm run build`: passed
