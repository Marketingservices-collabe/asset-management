# Asset Tracker — Architecture & Data Model

Internal asset-management tool for ZenTrades, modeled on AssetTiger.
See [PRODUCT_ANALYSIS.md](PRODUCT_ANALYSIS.md) for the reference product breakdown.

## Decisions locked

| Area | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, React Server Components, Server Actions + Route Handlers) |
| Language | TypeScript everywhere |
| DB | **PostgreSQL** |
| ORM | **Prisma** |
| Auth | **Auth.js (NextAuth v5)** — Google Workspace SSO + email/password fallback |
| UI | Tailwind CSS + shadcn/ui (Radix primitives), TanStack Table for grids |
| Validation | Zod (shared client/server schemas) |
| Files | **No upload / object storage in v1.** Photos & documents are stored as external **links** (Google Drive URLs etc.) on `photoUrl` / `Attachment.url`. |
| Background jobs | Secret-protected `/api/cron/*` route handlers, triggered by host scheduler or system crontab (daily alert scan, monthly depreciation close). `pg-boss` deferred — volume doesn't need a queue. |
| Barcode | `bwip-js` server-side (Code128 + QR) → PNG/SVG; label sheets as printable HTML. Standard label size (Avery 5160 / 2.625" × 1", 30-up). |
| Scanning | USB HID barcode scanners (keyboard-wedge) + web input field; no camera/app in v1 |
| Deploy | Single Node server + managed Postgres (Railway/Render/Fly). No Vercel-specific lock-in. |
| Scope | Web only. Internal to ZenTrades — **single org**, no SSO domain restriction, no billing. ~500 assets total (schema stays multi-tenant-capable for the future). |

## Non-goals for v1

Native mobile apps, camera scanning, public REST API, billing/subscriptions,
marketing site, BI dashboard builder, webhooks, accounting integrations.

---

## High-level architecture

```
┌────────────────────────────────────────────────────────────┐
│  Next.js app (single deployable)                            │
│                                                            │
│  app/(auth)          login, callback           Auth.js      │
│  app/(app)/[org]/…   authenticated UI (RSC)                 │
│  app/api/…           Route Handlers (webhook-ish, exports)  │
│  Server Actions      all mutations, Zod-validated           │
│                                                            │
│  lib/                                                       │
│   ├─ auth.ts         session, org membership resolution     │
│   ├─ authz.ts        permission checks (can(user, perm))    │
│   ├─ db.ts           Prisma client (singleton)              │
│   ├─ tenant.ts       withOrg() scoping helper               │
│   ├─ audit.ts        writeActivity() — called by all writes │
│   ├─ barcode.ts      code generation + label sheets         │
│   ├─ depreciation.ts pure functions per method              │
│   └─ alerts/         rule evaluation                        │
└───────────────┬─────────────────────────┬──────────────────┘
                │                         │
        ┌───────▼──────┐          ┌───────▼────────┐
        │ PostgreSQL   │          │ Object storage │
        │ (Prisma)     │          │ (S3-compatible)│
        └───────┬──────┘          └────────────────┘
                │
        ┌───────▼──────────────┐
        │ Worker process       │  pg-boss consumers:
        │ (same codebase,      │   • alert scan (cron 1/hr)
        │  `npm run worker`)   │   • depreciation month-close
        └──────────────────────┘   • scheduled report email
```

### Multi-tenancy

- Every domain row carries `orgId`.
- `withOrg(session)` resolves the active org from the URL segment `[org]` and the
  user's `Membership`; all queries go through helpers that inject `where: { orgId }`.
- No row-level security in v1 (app-enforced); revisit if we host external customers.

### Authorization

- `Role` per org holds a `permissions: string[]` (e.g. `asset.create`, `asset.delete`,
  `checkout.manage`, `maintenance.manage`, `report.view`, `settings.manage`,
  `user.manage`, `audit.run`, `inventory.manage`, `financials.view`).
- Seeded roles: **Admin** (all), **Manager** (no user/settings), **Staff**
  (asset view + check-in/out + maintenance log), **Auditor** (read + audit.run),
  **Read-only**.
- `can(session, 'asset.delete')` guard at the top of every Server Action + in UI.

### Audit / history

- `writeActivity({ orgId, actorId, entityType, entityId, action, before, after })`
  is called inside the same transaction as every mutation.
- `AssetEvent` is a denormalized, asset-scoped timeline (check-out, move, maintenance,
  field change) rendered on the asset detail page. `ActivityLog` is the org-wide
  immutable admin log.

---

## Data model (see `prisma/schema.prisma` for the full source)

### Identity & tenant
- **Organization** — name, slug, settings (JSON: date format, currency, fiscal year start).
- **User** — email, name, passwordHash?, image; global.
- **Membership** — User↔Organization, `roleId`, status.
- **Role** — org-scoped, `permissions String[]`, `isSystem`.

### Structure / reference data (all org-scoped)
- **Site** — name, address, lat/lng.
- **Location** — belongs to Site; `parentId` self-reference for aisle/shelf/bin.
- **Category** — asset type; owns **CustomFieldDef**s; default depreciation settings.
- **Department**.
- **Person** — custody target (employee/contractor); optional `userId` link; email for alerts.
- **Company** — role flags: `isVendor`, `ismanufacturer`, `isCustomer`; contact block.
- **CustomFieldDef** — `categoryId?` (null = applies to all), key, label, type
  (`TEXT|NUMBER|DATE|BOOL|SELECT`), options, required, order.

### Assets
- **Asset** — `tagId` (unique per org), name, description, `serialNo`,
  `categoryId`, `siteId`, `locationId`, `departmentId`, `assignedPersonId?`,
  `status` (`AVAILABLE|CHECKED_OUT|LEASED|RESERVED|UNDER_REPAIR|DISPOSED|LOST`),
  `purchaseDate`, `purchaseCost`, `poNumber`, `supplierId?`, `fundId?`,
  `depreciationMethod`, `salvageValue`, `usefulLifeMonths`, `depreciationStart`,
  `bookValue` (cached), `photoKey?`, timestamps.
- **CustomFieldValue** — `assetId`, `fieldDefId`, one typed value column.
- **AssetEvent** — `assetId`, `type`, `at`, `actorId`, `summary`, `dataJson`.

### Asset transactions
- **CheckoutRecord** — `assetId`, `personId?`/`locationId?`, `checkedOutAt`, `dueAt?`,
  `checkedInAt?`, `notes`, `outByUserId`, `inByUserId?`.
- **LeaseRecord** — `assetId`, `customerCompanyId`, `startAt`, `endAt`, `returnedAt?`,
  `rate`, `terms`.
- **Reservation** — `assetId`, `personId`, `fromAt`, `toAt`, `status`.
- **MoveRecord** — `assetId`, `fromSiteId/LocationId`, `toSiteId/LocationId`, `at`, `by`.
- **DisposalRecord** — `assetId`, `method` (`SOLD|DONATED|SCRAPPED|LOST`), `at`,
  `proceeds`, `notes`.

### Maintenance
- **MaintenanceSchedule** — `assetId?`/`categoryId?`, `title`, `intervalDays?` or
  `fixedDates Json`, `leadDays`, `assignedToPersonId?`, `active`, `nextDueAt`.
- **MaintenanceRecord** — `assetId`, `scheduleId?`, `dueAt?`, `completedAt?`,
  `technician`, `workPerformed`, `cost`, `status` (`SCHEDULED|OVERDUE|DONE|SKIPPED`).

### Coverage / financial (many-to-many with assets via join rows)
- **Warranty** — `assetId`, `provider`, `startAt`, `endAt`, `terms`, `leadDays`.
- **Contract** — `type` (`SERVICE|LEASE|SUPPORT`), `vendorCompanyId`, `startAt`,
  `endAt`, `value`, `autoRenew`, docs; **ContractAsset** join.
- **InsurancePolicy** — `provider`, `policyNo`, `coverageAmount`, `startAt`, `endAt`;
  **PolicyAsset** join.
- **Fund** — `name`, `code`, `amount`, `source`; referenced by `Asset.fundId` and
  spend rollups.

### Inventory (consumables)
- **InventoryItem** — `sku`, `name`, `unit`, `categoryId?`, `defaultReorderPoint`.
- **InventoryStock** — `itemId`, `locationId`, `quantity`, `reorderPoint?` (unique pair).
- **InventoryTxn** — `itemId`, `locationId`, `delta`, `type`
  (`RECEIVE|ISSUE|ADJUST|TRANSFER_IN|TRANSFER_OUT`), `reason`, `at`, `by`.

### Audit
- **Audit** — `name`, scope (`siteId?`, `locationId?`, `categoryId?`), `startedAt`,
  `closedAt?`, `status`.
- **AuditScan** — `auditId`, `assetId?` (null = unknown tag), `rawTag`, `scannedAt`,
  `foundLocationId?`, `result` (`FOUND|MOVED|UNEXPECTED`).
- Missing = assets in scope with no scan → computed in reconciliation report.

### Platform
- **Attachment** — `orgId`, `entityType`, `entityId`, `url` (external link — Drive etc.),
  `label`, `kind` (`PHOTO|DOCUMENT`), `addedById`. No file bytes stored.
- **AlertRule** — `orgId`, `type` (`CHECKOUT_OVERDUE|MAINT_DUE|WARRANTY_EXPIRY|
  CONTRACT_EXPIRY|POLICY_EXPIRY|LOW_STOCK`), `thresholdDays`, `recipients Json`,
  `cadence`, `active`.
- **Notification** — generated alert instances (for in-app bell + email log).
- **ActivityLog** — `orgId`, `actorId`, `entityType`, `entityId`, `action`,
  `beforeJson`, `afterJson`, `ip`, `at`.
- **SavedView** — `orgId`, `userId?`, `entity`, `name`, `configJson` (filters/columns).
- **ReportRun** — record of generated exports (params, file key, requestedBy).

---

## Reports (v1 set — parameterized templates, not a builder)

1. Asset register (full list, filterable)  2. Assets by location  3. Assets by category
4. Assets by department/person  5. Check-out history  6. Currently checked-out / overdue
7. Maintenance log & cost  8. Upcoming/overdue maintenance  9. Depreciation schedule
10. Book value summary  11. Warranty expirations  12. Contract & policy expirations
13. Disposal report  14. Audit reconciliation  15. Low-stock inventory
16. Inventory transaction ledger  17. Activity log export

Each: filter form → server query → on-screen table + CSV + PDF (via headless render).

---

## Depreciation

Pure functions in `lib/depreciation.ts`, one per method:
`STRAIGHT_LINE`, `DECLINING_BALANCE_200`, `DECLINING_BALANCE_150`, `SUM_OF_YEARS_DIGITS`.
Monthly `depreciation-close` job recomputes `Asset.bookValue` and appends a period row
to a `DepreciationEntry` table for the schedule report.

---

## Alerts pipeline

Hourly `alert-scan` job:
1. Load active `AlertRule`s per org.
2. For each type, run the corresponding query (e.g. overdue checkouts, maintenance
   within `leadDays`, warranties expiring within threshold, stock below reorder point).
3. Upsert `Notification` rows (dedup by rule+entity+period).
4. Batch email per recipient (respect `cadence`: immediate / daily digest).

---

## Proposed milestone plan

- **M0 — Scaffolding:** ✅ Next.js + Prisma + Auth.js + Tailwind, DB, seed script,
  role guard, layout shell, activity-log helper.
- **M1 — Assets core:** ✅ Category/Site/Location/Department/Person/Company CRUD, custom fields,
  Asset CRUD + list grid + detail + history + status control, photo/doc links,
  barcode/QR generation + Avery 5160 label sheet.
- **M2 — Custody:** ✅ Check-out/in, reservations, moves, disposal, `/api/cron/alerts`
  scan (overdue checkouts, maintenance due, warranty/contract/policy expiry, low stock →
  Notification rows + email digest stub).
- **M3 — Maintenance:** ✅ recurring schedules (interval-based), work-log records with
  complete/skip + auto roll-forward, ad-hoc logging, /maintenance page, asset-detail
  maintenance card, dashboard widget, cron flips past-due SCHEDULED → OVERDUE.
- **M4 — Import/Export + Reports:** ✅ CSV import wizard (auto-map, preview, auto-create refs,
  dedup), report registry with 12 parameterized reports (5 more need M5/M6 modules), CSV export
  (`/api/reports/[key]`), print-to-PDF stylesheet, paginated `/activity` log page.
- **M5 — Coverage & finance:** ✅ warranties (per asset), contracts + insurance (many-to-many
  assets via `<CoverageForm>`), funds (with allocation rollup), depreciation month-close
  (`/api/cron/depreciation` + "Run now" on `/depreciation`, backfills `DepreciationEntry`),
  expiry alerts + 2 expiry reports now live, asset-detail Coverage card.
- **M6 — Inventory + Audit:** ✅ consumable items, per-location stock, receive/issue/adjust/
  transfer ledger, per-location reorder points + LOW_STOCK alert; audit sessions with a scan
  box, found/missing/moved/unexpected reconciliation, close/reopen, "apply moves" (bulk
  location correction). 2 inventory reports added (registry now 16).
- **M7 — Polish:** ✅ in-app notifications center + header bell, `/account` (password change +
  TOTP 2FA, enforced at login), admin screens (`/admin/users`, `/admin/roles` with a grouped
  permission editor, `/admin/alerts` rule config, `/admin/org` settings), saved list views on
  `/assets`. All milestones complete.

---

## Resolved (2026-08-29)

- **Files:** external links only (Google Drive URLs); no upload/object storage in v1.
- **Auth:** Google sign-in + password; no domain restriction (internal use).
- **Tenancy:** single org for now; schema stays multi-tenant-capable.
- **Volume:** ~500 assets → offset pagination + Postgres `ILIKE`/`pg_trgm` search, no external search engine.
- **Labels:** standard Avery 5160 (2.625" x 1", 30-up) printable HTML sheet.

## Open questions

- None blocking. Confirm hosting target (Railway / Render / self-host) at deploy time.
