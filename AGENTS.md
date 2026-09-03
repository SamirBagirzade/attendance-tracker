# AGENTS.md

## Project overview

This is a single-organisation attendance and operations application built with
Next.js App Router, TypeScript, Prisma, and PostgreSQL. It covers employee
attendance, reporting and catering, vehicles and maintenance, fuel spend, and
integrations with Azpetrol and Wialon. The interface is localized in
Azerbaijani, English, and Russian through `src/lib/i18n.tsx`.

## Repository map

- `src/app/`: App Router pages and API route handlers. Each `api/**/route.ts`
  file owns a REST endpoint.
- `src/components/`: shared client-side UI, including `AppShell.tsx` for page
  navigation and application chrome.
- `src/lib/`: domain validation/normalization, Prisma access, auth,
  permissions, date handling, audit logging, and external integrations.
- `prisma/schema.prisma`: current Prisma data model; `prisma/migrations/`:
  migration history.
- `src/proxy.ts`: global request middleware (Next.js 16's replacement for
  `middleware.ts`).
- `src/instrumentation.ts`: Node-runtime startup tasks, including stale fuel
  and odometer sync checks.
- `DEPLOYMENT.md`, `deploy.sh`, and `deploy-light.sh`: production deployment
  runbook and scripts.

## Commands

```bash
npm run dev                 # local development server
npm run build               # prisma generate, then production build
npx tsc --noEmit            # type-check
npm run lint                # lint the repository
npx prisma generate         # regenerate Prisma client after schema changes
```

Run the narrowest relevant check during development. Before handing off a
non-trivial change, run `npx tsc --noEmit` and/or `npm run build` when the
environment permits. Do not automatically fix unrelated lint findings.

## Implementation conventions

- Use the `@/*` alias for code under `src`.
- Keep input validation and normalization in the relevant `src/lib/*` module.
  Normalizers throw for invalid input; handlers catch errors and return a
  suitable HTTP response.
- New mutating API endpoints must perform explicit authorization with
  `requireEditor` or `requireAdmin` from `src/lib/permissions.ts`. The proxy is
  a useful first gate, but is not sufficient authorization on its own.
- Add audit events for meaningful mutations with `logAudit`.
- Use `Object.hasOwn(...)` or `Object.values(Enum).includes(...)` to validate
  enum values. Do not use `in`, since it accepts prototype properties.
- Preserve the existing UI style: Tailwind utility classes, `lucide-react`
  icons, `AppShell` for authenticated pages, and translations through
  `useLanguage` rather than hard-coding new user-facing strings.
- Money values are AZN and are currently stored as Prisma `Float` fields.
- Every intentionally unawaited promise must handle its own failure with
  `.catch()` (or an equivalent rejection handler), since unhandled rejections
  can terminate the server.

## Dates: strict rules

Date-only database fields use `@db.Date`; treat them as calendar dates, not
timestamps.

- Parse writes and date filters with `parseCalendarDate` / `parseDateParam`
  from `src/lib/dates.ts`. They normalize to noon UTC to avoid timezone shifts.
- Serialize API date fields using `toApiDateKey`.
- Use `bakuDateKey()` for the current calendar day. Do not derive it with
  `new Date().toISOString().slice(0, 10)`, which is wrong in Baku before 04:00.
- Prisma reads `@db.Date` values back at midnight UTC, so normalize values
  before comparing dates that originated from different directions.

## Auth and access control

- Roles are `ADMIN`, `SUPERVISOR`, `EDITOR`, and `VIEWER`.
- Admin credentials come from `ADMIN_USERNAME` and `ADMIN_PASSWORD`; they are
  intentionally separate from `AppUser` records. Both variables are required.
- Sessions are stateless, eight-hour JWTs. A user role or active-state change
  takes effect on their next session, not immediately on existing tokens.
- The proxy permits certain webhook/sync paths through so their handlers can
  authenticate with `CRON_SECRET` or `FORMS_WEBHOOK_SECRET`. Keep that list and
  handler-level verification in sync when adding such an endpoint.
- Older attendance records are restricted by `requireDateEditable`; retain
  that check on create and update paths that can affect a record date.

## Prisma and database safety

The checked-in migrations have historical schema drift: some production schema
changes were applied with `prisma db push` and do not exist in migrations.
Therefore, do not assume `prisma migrate deploy` can create a usable fresh
database, even if `prisma migrate status` says it is current. Inspect the live
schema and discuss a migration/reconciliation plan before making schema or
deployment changes.

`prisma.config.ts` reads `DATABASE_URL`; `SHADOW_DATABASE_URL` is optional and
needed only by migration workflows that replay migration history. Never expose
or commit `.env` values.

## Integrations and operations

- Azpetrol permits one active customer session. Its client retries once after a
  401; retain that recovery behavior. Its history is limited to roughly 30
  days, so sync failures must remain visible as partial/failed chunks. Type 21
  is a sale and type 22 is a refund; refunds are stored as negative amounts and
  quantities.
- Wialon's `-348201.3876` means no valid reading. Pass report values through
  `isNaReading` before rendering them.
- Startup may automatically launch syncs if data is older than 12 hours. Those
  background tasks must remain independent and rejection-safe.
- Production runs `next start` under the `attendance-tracker` systemd service.
  A commit or source edit is not deployed until a production build completes
  and the service is restarted. Follow `DEPLOYMENT.md` for deployment and
  backup/restore procedures.
- Backup endpoints create real PostgreSQL dumps. There is deliberately no web
  restore endpoint. `pg_dump`/`pg_restore` require the `?schema=` suffix to be
  removed from `DATABASE_URL`.

## Scope discipline

Preserve existing user changes and avoid unrelated formatting or generated-file
churn. Read neighboring routes, normalizers, and serializers before extending a
feature so error handling, permissions, and response shape stay consistent.
