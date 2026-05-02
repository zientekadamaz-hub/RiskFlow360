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
- `npm run check` - full local quality gate (`lint + typecheck + build`).

## Regression Scripts

Browser regressions require valid Supabase credentials plus dedicated regression users and project ids.

- `npm run regression:all`
- `npm run regression:pfmea:merge`
- `npm run regression:pfmea:order`
- `npm run regression:pfmea:save`
- `npm run regression:pcp:smoke`
- `npm run regression:pcp:save`

## Architecture Notes

- Public entry points (`/`, `/login`, `/request-access`, `/waiting-for-invite`) now use a shared public shell.
- Authenticated pages use a shared application header with safer login redirects.
- Severity, occurrence and detection settings share one configurable implementation instead of three separate copies.
- The public request-access form writes through `app/api/request-access/route.ts` with server-side validation.

## Known Legacy Areas

The largest remaining technical debt is still concentrated in the monolithic PFMEA, PFD and PCP pages. ESLint now passes without blocking errors, but those legacy modules still emit warnings and need a dedicated cleanup pass.
