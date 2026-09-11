# Asset Tracker

Internal asset & inventory management for ZenTrades, modeled on AssetTiger.

- **Product analysis:** [PRODUCT_ANALYSIS.md](PRODUCT_ANALYSIS.md)
- **Architecture & data model:** [ARCHITECTURE.md](ARCHITECTURE.md)

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL · Prisma · Auth.js v5 · Tailwind CSS

## Local setup

1. **Database** — you need a Postgres URL. Options:
   - Local Postgres: create a db `asset_tracker`.
   - Free hosted: [neon.tech](https://neon.tech) → copy the connection string.

2. **Env**
   ```bash
   cp .env.example .env
   # set DATABASE_URL, then:
   openssl rand -base64 32   # paste into AUTH_SECRET and CRON_SECRET
   ```

3. **Install & migrate**
   ```bash
   npm install
   npm run db:migrate      # creates tables
   npm run db:seed         # org "ZenTrades", roles, admin user, sample data
   ```

4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and sign in with the seed admin
   (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`).

## Google sign-in (optional)

Set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and `NEXT_PUBLIC_GOOGLE_ENABLED=1`.
Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
No domain restriction — anyone who signs in gets a User row but needs a Membership
(added via admin) to access the app.

## Cron jobs

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/alerts
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/depreciation
```

## Project layout

```
prisma/schema.prisma      full data model (~40 models)
prisma/seed.ts            demo/seed data
src/lib/
  db.ts                   Prisma singleton
  auth.ts                 Auth.js config (credentials + Google, JWT sessions)
  session.ts              getContext() / requireContext() / requirePermission()
  authz.ts                permission catalogue + system roles + can()
  activity.ts             writeActivity() / writeAssetEvent()
  depreciation.ts         pure schedule builders
src/middleware.ts         session-cookie redirect guard
src/app/(app)/            authenticated UI (sidebar shell + dashboard)
src/app/login/            sign-in
src/app/api/cron/[job]/   secret-protected cron entrypoints
```

## Status

- **M0 — scaffolding.** ✅ Auth, data model, dashboard, nav shell.
- **M1 — assets core.** ✅ Setup CRUD (categories, sites/locations, departments, people,
  companies, custom fields), asset list/create/edit/detail + history, status changes,
  barcode/QR generation, Avery 5160 label sheets.
- **M2 — custody.** ✅ Check-in/out with due dates + overdue detection, reservations,
  move/transfer, disposal, and the `/api/cron/alerts` scan (Notification rows + email
  digest stub in `src/lib/email.ts`).
- **M3 — maintenance.** ✅ Recurring schedules, complete/skip with automatic
  roll-forward to the next occurrence, ad-hoc work logging, `/maintenance` dashboard,
  per-asset maintenance card, cron overdue flip.
- **M4 — import / export + reports.** ✅ CSV import wizard (`/setup/import`), 12
  parameterized reports (`/reports`) with CSV export + print-to-PDF, paginated
  activity log (`/activity`).
- **M5 — coverage & finance.** ✅ Warranties, contracts & insurance (both link many
  assets), funds with allocation rollup, and the depreciation month-close job.
- **M6 — inventory & audits.** ✅ Consumable items with per-location stock,
  receive/issue/adjust/transfer ledger, reorder points; audit sessions with a scan
  box and found/missing/moved/unexpected reconciliation + "apply moves". 16 reports.
- **M7 — polish.** ✅ In-app notifications + header bell, `/account` (password + TOTP
  2FA enforced at login), admin screens (users, roles + permission editor, alert rules,
  org settings), saved list views.
- **UI pass.** Design-token theming (light/dark), lucide icons, restyled
  cards/tables/nav/dashboard; `#ee5566` brand.

**All planned milestones (M0–M7) are complete.** 42 routes. See ARCHITECTURE.md.
