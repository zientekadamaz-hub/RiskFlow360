# PFMEA App

Next.js application for managing process projects, PFD, PFMEA and PCP data in a shared workflow.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Supabase
- Tailwind CSS v4

## Local Development

1. Install dependencies:

```bash
npm ci
```

2. Configure environment variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BASE_PATH=
```

3. Start the app:

```bash
npm run dev
```

## Quality Gates

- `npm run lint` - ESLint across app, shared source and regression helpers.
- `npm run typecheck` - TypeScript validation without emitting files.
- `npm run build` - production build validation.
- `npm run check` - full local quality gate (`lint + typecheck + shared regression + build`).

## Regression Scripts

Browser regressions require valid Supabase credentials plus dedicated regression users and project ids.

- `npm run regression:all`
- `npm run regression:pfmea:merge`
- `npm run regression:pfmea:order`
- `npm run regression:pfmea:save`
- `npm run regression:pcp:smoke`
- `npm run regression:pcp:save`
- `npm run regression:shared`
- `npm run regression:app-header`
- `npm run regression:error-utils`
- `npm run regression:pfmea-action-validation`
- `npm run regression:pfmea-continuation`
- `npm run regression:pfmea-date`
- `npm run regression:pfmea-display`
- `npm run regression:pfmea-hierarchy`
- `npm run regression:pfmea-operation`
- `npm run regression:pfmea-payload`
- `npm run regression:pfmea-pcp`
- `npm run regression:pfmea-revision`
- `npm run regression:pfmea-row-factory`
- `npm run regression:pfmea-row-normalization`
- `npm run regression:pfmea-row-match`
- `npm run regression:pfmea-row-order`
- `npm run regression:pfmea-risk`
- `npm run regression:pfmea-value`
- `npm run regression:risk-engine`

## Demo Seed Safety

`scripts/seed/watlow-demo-data.mjs` uses `SERVICE_ROLE_KEY` and rewrites demo project data. It is guarded and refuses to run unless `ALLOW_DEMO_SEED=YES` is set.

Required only for intentional demo seeding:

```bash
ALLOW_DEMO_SEED=YES
SUPABASE_URL=...
SERVICE_ROLE_KEY=...
DEMO_SEED_ORG_NAME=WATLOW
```

Run it only against a known demo or staging organization.

## Architecture Notes

- Public entry points (`/`, `/login`, `/request-access`, `/waiting-for-invite`) now use a shared public shell.
- Authenticated pages use a shared application header with safer login redirects and split navigation/user/dropdown components.
- Shared UI standards live under `src/components/rf-ui/*`; `src/features/settings/invitation-shell.tsx` is only a compatibility adapter for older imports.
- Shared error handling lives in `src/lib/error-utils.ts` and should be used for new Supabase/API user-facing errors.
- PFMEA hierarchy, operation matching, row factories, payload/select contracts, row ordering, row matching, row normalization, PCP decision logic, date helpers, value normalization, action validation, display helpers, revision helpers and risk calculations live in `src/features/pfmea/*-utils.ts`; all are covered by smoke regressions.
- Severity, occurrence and detection settings share one configurable implementation instead of three separate copies.
- The public request-access form writes through `app/api/request-access/route.ts` with server-side validation.
- Supabase migrations should be added to `supabase/migrations/`; `db/` is treated as a legacy/manual SQL archive until schema diff consolidation is complete.

## Known Legacy Areas

The largest remaining technical debt is still concentrated in the monolithic PFMEA, PFD and PCP pages. ESLint now passes without blocking errors, but those legacy modules still emit warnings and need a dedicated cleanup pass.
