# AssetTiger — Deep Product Analysis

> Purpose: understand AssetTiger thoroughly as the reference product before building a
> similar asset‑management SaaS. Compiled 2026‑08‑29 from AssetTiger's public site
> (assettiger.com), its FAQ/feature pages, and third‑party reviews. The authenticated
> dashboard itself is login‑gated and was **not** directly inspected — items marked
> _(inferred)_ come from product knowledge/reviews and should be verified against a
> live trial account.

---

## 1. What AssetTiger is

A cloud (SaaS) **fixed‑asset and inventory tracking** system. It replaces
spreadsheets + clipboards with:

- a shared web database,
- barcode / QR **tags** on physical things,
- an **iOS/Android scanner app**,
- automated **email alerts**, and
- **80+ canned reports**.

**Positioning:** "Know what you own, where it is, and who has it."
**Business model:** free up to 250 assets (30‑day full-feature trial, then view‑only),
then paid by **asset‑count tier**, never per user. Unlimited users on every paid plan.
Sister company **MyAssetTag.com** sells the physical tags (the real revenue engine).

**Target customers:** SMBs, K‑12 / higher‑ed, local government, non‑profits, churches,
IT departments, medical/dental practices, construction. ~100k organizations.

### Pricing tiers (asset capacity is the only lever)

| Plan | Asset limit | ~Monthly |
|---|---|---|
| Free trial | 250 | Free (30 days) |
| Basic | 500 | ~$20 |
| Core | 2,500 | ~$40 |
| Advanced | 10,000 | ~$75 |
| Pro | 50,000 | ~$140 |
| Enterprise | 250,000 | ~$275 |

Trial caps (not on paid): 2 users, 5 custom fields, 50 sites/categories/departments,
100 contracts/funds/insurance, 500 gallery items, 100 alerts/day.

---

## 2. Core domain model

```
Organization (tenant; a login can hold several orgs, data isolated per org)
 ├── Users ─── Role (permission set)
 ├── Sites ──> Locations (hierarchical: site → location → aisle/shelf/bin)
 ├── Categories (asset types; each can carry its own custom fields)
 ├── Departments
 ├── Persons / Employees (custody targets; not necessarily system users)
 ├── Customers / Vendors / Companies (directory used by contracts, warranty, PO)
 │
 ├── Asset (the central record)
 │    ├── identity: asset tag ID (barcode/QR), name, description, serial no, photo/docs
 │    ├── classification: category, site, location, department, assigned person
 │    ├── financial: purchase date, cost, PO, supplier, funding source, current value
 │    ├── depreciation schedule (method + salvage + life)
 │    ├── status: Available / Checked out / Leased / Under repair / Disposed / Lost
 │    ├── custom fields (per category)
 │    └── event history (immutable log)
 │
 ├── Asset events / transactions
 │    ├── Check-Out / Check-In      (to person / location, optional due date)
 │    ├── Lease / Lease Return      (to a customer, with lease dates & terms)
 │    ├── Reserve / Reservation     (future date range hold)
 │    ├── Move / Transfer           (site/location change)
 │    ├── Dispose / Donate / Sell   (end of life, with date + value)
 │    └── Bulk update               (edit many assets at once)
 │
 ├── Maintenance
 │    ├── Scheduled (recurring by date or interval) + one-off
 │    ├── Work record: date, technician, work done, cost, status
 │    └── overdue detection → dashboard + email
 │
 ├── Warranty            (per asset: term, expiry, vendor contact) → expiry alerts
 ├── Contracts / Leases  (vendor/service/lease; links many assets; doc attach; expiry alert)
 ├── Insurance policies  (coverage amount, policy no, renewal date; links assets)
 ├── Funding / Funds     (grant / budget code allocation — nonprofit & gov use)
 │
 ├── Inventory items (consumables — quantity-tracked, NOT individually tagged)
 │    ├── stock on hand per location
 │    ├── transactions: add / remove / adjust / transfer (reason code, user, timestamp)
 │    └── reorder point per item/location → low-stock alert
 │
 ├── Audits
 │    ├── audit session (scope: site/location/category)
 │    ├── scanned items collected (mobile, offline-capable)
 │    └── reconciliation report: found / missing / moved / unexpected
 │
 ├── Reports (80+ templates + custom report builder over any field)
 ├── Alerts / Reminders (configurable rules, frequency, recipients)
 └── Activity log (every user action: who, what, when, IP, before/after values)
```

---

## 3. Navigation / feature map _(sidebar structure, partly inferred from reviews)_

- **Dashboard** — counts (total assets, value, YTD purchases), status breakdown,
  upcoming/overdue maintenance, alert calendar, Google Map of asset locations,
  quick actions ("Add an Asset", "Check-Out").
- **Assets**
  - List of Assets (filter, saved views, column chooser, bulk select)
  - Add an Asset
  - Check-Out / Check-In
  - Lease / Lease Return
  - Reserve
  - Move / Transfer
  - Dispose
  - Maintenance (list + schedules)
  - Warranties
  - Update Assets (bulk edit)
- **Advanced** — Contracts, Insurance, Funding
- **Tools**
  - Reports
  - Import (CSV/Excel, column auto‑map)
  - Export (any list/report → CSV/PDF)
  - Audit
- **Setup** — Sites, Locations, Categories, Departments, Persons, Customers, Databases,
  Customize Forms (per‑form field layout + custom fields), Company Info, Alerts.
- **Account** — Users, Roles/Security Groups, Subscription/Billing, Activity Log,
  2FA settings, Google SSO.

---

## 4. Key workflows

1. **Onboarding wizard** — company info → sites/locations → categories →
   import assets (CSV) → invite users → print tags.
2. **Tag & scan** — generate barcode/QR per asset, print on any label printer or buy
   durable tags; mobile scan opens the asset record.
3. **Check‑out** — pick asset(s) + person/location + optional due date → logged;
   overdue → email alert; scan again to check in.
4. **Maintenance** — define schedule (interval or fixed dates) → items become due →
   surface on dashboard + daily digest email → technician logs completion + cost.
5. **Audit** — start session, define scope, walk & scan (offline queue), sync →
   auto reconciliation report; apply found‑elsewhere moves in bulk.
6. **Depreciation** — set method (straight‑line, double‑declining, 150% declining,
   sum‑of‑years‑digits), salvage value, useful life → monthly/yearly schedule + report.
7. **Reporting** — pick template or build custom, filter, schedule email delivery,
   export CSV/PDF.

---

## 5. Cross-cutting / platform

- **Multi-tenant** with per-org data isolation; one login → many orgs.
- **Unlimited users**, **role-based permissions** (~120 granular toggles: view/add/edit/
  delete/check-out/report/export per module; custom roles).
- **Auth:** email/password, Google sign-in / Workspace SSO, 2FA (authenticator or SMS).
- **Alerts engine:** rule-based email notifications (overdue checkout, maintenance due,
  warranty/contract/insurance expiry at 30/60/90 days, low stock, user activity);
  configurable cadence + recipients.
- **Mobile apps** (iOS/Android): scan, check in/out, audit, maintenance, inventory,
  photo capture, **offline** with sync.
- **REST API** (api.assettiger.com): bearer token, JSON, CRUD over resource groups,
  sandbox + Swagger docs. _(exact scope to verify)_
- **Import/Export:** CSV/Excel in; CSV/PDF out; Excel export _(verify)_.
- **Attachments:** photos + documents per asset / contract / maintenance record.
- **Google Maps** integration for location visualization.
- **Activity log:** immutable, exportable, per-action with IP + field-level diff.
- **Security posture (claimed):** TLS in transit, SOC 2 infra, automated backups.

---

## 6. Known weaknesses (opportunities for our product)

- Dated UI; sidebar deep-nesting (maintenance buried under Assets).
- Maintenance is basic — no predictive/condition-based, no parts inventory tie-in,
  no technician mobile work-order flow, no vendor portal.
- Report **customization** is limited; no dashboards/BI, no pivot.
- Mobile app performance complaints (laggy animations).
- No in-app messaging / collaboration / comments.
- No native accounting / ERP / procurement integrations (only raw API + CSV).
- Only forms that are highly customizable = the asset form; other entities less so.
- No webhooks / automation builder _(verify)_.

---

## 7. Implications for building "software like this"

MVP backbone (must-have to be credible):
1. Multi-tenant org + users + granular roles.
2. Asset CRUD with categories, custom fields, sites/locations hierarchy, photos/docs.
3. Barcode/QR generation + label printing + web/mobile scan.
4. Check-in/out with custody history + due dates + overdue alerts.
5. Import (CSV) / export (CSV/PDF).
6. Maintenance schedules + logs.
7. Audit / reconciliation with mobile scan.
8. Depreciation (at least straight-line + declining balance).
9. Reports (parameterized templates) + activity log.
10. Alert/notification engine (email).

Phase 2: contracts / warranty / insurance / funding, inventory (consumables),
reservations, leasing, REST API, SSO/2FA, scheduled report delivery, Google Maps,
multi-org switching.

Phase 3: custom dashboards/BI, automation/webhooks, work-order mobile flow,
accounting integrations, predictive maintenance.

---

## 8. Open questions to resolve before coding

- Target platform: web-first + PWA scanner, or native mobile too?
- Scale target (assets per tenant, tenants) → DB + search choices.
- Tech stack preference (see build plan).
- Which of the 10 MVP items are in the first milestone?
- Branding / is this a direct competitor or internal tool?
