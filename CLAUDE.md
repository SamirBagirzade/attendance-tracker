# attendance-tracker

Next.js (App Router) + Prisma + Postgres. Tracks employee attendance, a vehicle
fleet, fuel spend and catering costs for a single organisation. UI is
Azerbaijani / English / Russian through `src/lib/i18n.tsx`.

```
npm run build          # prisma generate + next build
npx tsc --noEmit       # typecheck
npx eslint src/        # lint (13 pre-existing react-hooks problems — not yours)
```

## Dates — read this before touching anything date-shaped

This is the single largest source of bugs in the codebase.

- Every `@db.Date` value is written through `parseCalendarDate` (`src/lib/dates.ts`),
  which normalises to **noon UTC**. Noon rather than midnight so that neither the
  server timezone nor Postgres session casting can shift the calendar day.
- Prisma's pg adapter reads those same columns back as **midnight UTC**. Writes and
  reads are not symmetric. Never compare a date you wrote against one you read
  without normalising both first.
- "What day is it right now" is `bakuDateKey()` — never
  `new Date().toISOString().slice(0, 10)`. The server runs Asia/Baku (UTC+4) with no
  `TZ` set, so the UTC date is still yesterday between 00:00 and 04:00 local.
- Serialise dates out of an API with `toApiDateKey`.
- Known bug: `isDateEditLocked` compares a noon-UTC "today" against a midnight-UTC
  record date, so the by-id attendance routes lock records one day early while the
  create/update/bulk routes use the correct boundary.

## Auth

- `src/proxy.ts` is the global middleware — Next.js 16 renamed `middleware.ts` to
  `proxy.ts`. It runs on every request. **If a route handler seems never to execute,
  check here first.**
- It is currently the only gate for many mutating routes. New routes must *also*
  call `requireAdmin` / `requireEditor` from `src/lib/permissions.ts`; do not rely on
  the proxy alone.
- Roles are ADMIN, SUPERVISOR, EDITOR, VIEWER. The proxy blocks VIEWER from every
  non-GET API call. SUPERVISOR is used only by the record edit lock.
- The ADMIN login is env-based (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) and separate from
  the `AppUser` table — an `AppUser` row can never hold the ADMIN role. Both env vars
  are required; there is deliberately no default.
- Sessions are stateless 8-hour JWTs. Deactivating a user or changing their role has
  no effect until the token expires.

## Prisma

- Driver adapter `@prisma/adapter-pg`; client singleton in `src/lib/prisma.ts`.
- **The migrations are drifted from `schema.prisma`.** Several models and many columns
  exist only because they were applied with `db push`. Do not trust
  `prisma migrate deploy` on a fresh database — it will build a schema the code cannot
  run against. Note that `prisma migrate status` reports "up to date" regardless,
  because it only compares the applied-migrations table.
- The in-app backup/restore at `/api/backups` round-trips only a subset of columns and
  cascade-deletes tables it does not carry. **Use `pg_dump` for anything you actually
  intend to restore from.**

## Integrations

- **Azpetrol** (`src/lib/azpetrol-client.ts`) allows one active session per customer, so
  a login from anywhere else silently invalidates our cached token. `authedFetch`
  force-refreshes once on a 401 to recover. The history window is roughly 30 days —
  a sync gap older than that cannot be backfilled at all, which is why chunk failures
  are surfaced as `partial`/`failedChunks` rather than swallowed. Transaction type 21
  is a sale and 22 a refund; refunds are stored with negated amount and quantity so
  every downstream `SUM()` nets out on its own.
- **Wialon** (`src/lib/wialon-client.ts`) reports `-348201.3876` as a "no valid reading"
  sentinel instead of null. Run anything from a report through `isNaReading` before it
  reaches the UI. Configured by four `WIALON_*` env vars.

## Conventions

- Input normalisers live in `src/lib` (`attendance.ts`, `cars.ts`, `employee.ts`, …) and
  throw on invalid input; route handlers catch and map to a status code.
- Careful: `normalizeCarInput` and `normalizeEmployeeInput` return every field, so PATCH
  on cars and employees is currently a full replace — an omitted key is written as null.
- Validate enum membership with `Object.hasOwn` or `Object.values(Enum).includes`, never
  `in`, which walks the prototype chain.
- Money is AZN, stored as `Float`.
- Fire-and-forget promises must carry their own `.catch()`; an unhandled rejection
  terminates the process.
