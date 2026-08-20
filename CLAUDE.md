# CC Sacramento

## Project
- Name: CC Sacramento (Centro Comercial Sacramento, Carrizal, Los Teques, Venezuela)
- Full-stack administrative system to replace spreadsheet-based management
- Access roles: admin (full control) and subadmin (read and register, no delete/configure)

## Tech stack
- Frontend: Angular (standalone components, latest stable version) + SCSS
- Backend/Auth/DB: Supabase (Auth + PostgreSQL + RLS + Storage + Edge Functions)
- No separate Node/Express backend — Supabase handles the entire backend
- Frontend hosting: Vercel
- Reports: Edge Functions for heavy reports, jsPDF/SheetJS for simple client-side reports
- Exchange rates: BCV, USDT, EUR via Supabase Edge Functions

## Design system
- Color palette: white, gray, and orange (#f97316) as accent color
  - Orange is used sparingly: primary button, input focus, logo icon
  - Avoid saturating the UI with orange — it's an accent, not a dominant color
- Typography:
  - Inter (general text, UI, body copy)
  - Plus Jakarta Sans (headings/titles)
- SCSS structure: organized global partials (variables, mixins, typography, etc.)
- Favicon (`public/favicon.ico`) is a tight circular crop of `public/images/logo.jpg`
  (the same building badge used in the sidebar/login), regenerated with Pillow —
  no white/checkerboard halo, transparent background

### Shared UI utilities (in `src/styles.scss` — global, not component-scoped)
Reuse these instead of duplicating table/button CSS per feature; every transaction
list in the app already uses the shared table classes.
- **`.btn` + `.btn--primary` / `.btn--secondary` / `.btn--ghost` / `.btn--danger`**
  — base button system.
- **`.data-table-wrapper` / `.data-table` / `.data-table__amount` /
  `.data-table__actions` / `.data-table__edit`** — the transaction-table system.
  Gives every table (Pagos, Egresos, Caja chica, and the local detail page's
  "Historial de pagos") the same look: white card wrapper, uppercase muted
  header, **light grey (`--color-surface-muted`) row background**, a right-hand
  action column with a circular pencil "edit" icon button, and left-aligned
  amount cells (deliberately *not* right-aligned — a past attempt at
  right-aligning `Monto` looked mismatched against the other columns).
  Dashboard's two compact "Últimos pagos/egresos" panels are the one exception:
  they keep their own smaller padding (no `min-width`, would break the
  two-column panel layout) but still copy the same grey `tbody tr` background
  for visual consistency.
  When adding a new transaction table, use `class="data-table-wrapper"` on the
  wrapper and `class="data-table"` on the `<table>` — don't recreate the
  th/td/row styling locally.
- **Directives in `src/app/shared/directives/`**: `appSelectOnFocus` (selects
  the field's value on focus, so typing over a `0`-default number input
  overwrites instead of prepending) and `appPositiveDecimal` (blocks `e`/`E`/
  `+`/`-` keys, since `type="number"` otherwise accepts scientific notation)
  — both applied to **every** currency "monto" input across the app (pagos,
  egresos, caja chica, locales' `montoAlquiler`, calculadora). Apply both to
  any new amount field.
- **`ConfirmDialogService`** (`src/app/shared/services/confirm-dialog.service.ts`)
  + `<app-confirm-dialog>` (mounted once in `app.html`, available app-wide) —
  the app's custom replacement for `window.confirm()`. Inject the service and
  `await confirmDialog.confirm({ title, message, confirmLabel, danger: true })`
  before any destructive action (currently used by local deletion). Never use
  the native browser `confirm()`/`alert()` — it was explicitly rejected as
  looking out of place.
- Local's `numeroLocal` (e.g. "18") is intentionally shown **only** inside the
  Locales feature (card, detail page, forms) — it was deliberately removed
  from Pagos, Egresos, Caja chica, and the Dashboard as not relevant there.

## Database (PostgreSQL via Supabase)
Tables: usuarios, locales, pagos, servicios_pagos, egresos, caja_chica,
remodelaciones, tasas_cambio, documentos

- Implemented (migration + RLS in `supabase/migrations/`): usuarios, locales,
  pagos, documentos, tasas_cambio, egresos, caja_chica
- Not yet implemented: servicios_pagos, remodelaciones

## Folder structure (feature-based)
```
src/app/
├── core/                     # Singletons: guards, interceptors, services
│   ├── guards/                # auth.guard.ts, role.guard.ts
│   ├── services/               # supabase.service.ts, auth.service.ts
│   └── models/                 # TS interfaces aligned with the Postgres schema
├── shared/                   # Reusable components/pipes/directives
├── features/                 # One folder per business module
│   ├── auth/
│   ├── dashboard/
│   ├── locales/
│   ├── pagos/
│   ├── egresos/
│   ├── caja-chica/
│   ├── tasas-cambio/
│   ├── calculadora/
│   └── reportes/
├── layout/                   # Shell: sidebar, navbar, main-layout
└── styles/                   # Global SCSS: _variables, _mixins, _typography
```

Each feature is lazy-loaded via routes, and contains its own components,
service(s), and routes file.

## Adopted design patterns
- **Repository Pattern**: each feature encapsulates its Supabase calls in
  a dedicated service (e.g. LocalesService), never called directly from
  components. Eases testing and allows swapping the data source without
  touching the UI.
- **Smart/Dumb Components**: "smart" components (containers) handle state
  and business logic; "dumb" components (presentational) only receive
  @Input()/@Output(), with no logic of their own, and are reusable across
  features.

When generating new code, follow this structure and these patterns strictly.
Any new component or service belongs in its corresponding feature folder,
not in the root of app/.

## Working conventions
- **Language rule**: all code, file/folder names, variables, functions, classes,
  components, comments, commit messages, and explanations are in English.
  The only exception is client-facing text — anything the end user (admin/subadmin)
  actually sees in the UI: labels, buttons, messages, validation errors, PDF/report
  content — which is written in Spanish.
- Development environment: Windows, PowerShell, VS Code
- Prefer step-by-step progress: test each working piece before moving on
- The user wants to understand the backend architecture, not just copy/paste solutions

## Current status
- **The app is live** (Vercel frontend + Supabase backend)
- Auth: real login via Supabase Auth (`login-page`, `auth.service`, `auth.guard`
  protecting all routes under the main layout). Role is stored on `usuarios.rol`
  but the UI doesn't yet restrict subadmin actions — only RLS enforces it today.
  Every table's RLS lets admin **and** subadmin insert/select, but **only
  admin** can update/delete (`pagos`, `egresos`, `caja_chica`, `locales` all
  follow this same pattern) — a subadmin clicking edit/delete gets a Supabase
  error surfaced in the UI, by design, until role-based UI gating is built
- All 6 sidebar modules are built and wired to real Supabase data:
  - **Dashboard**: fully live — caja chica balance, Locales activos, Egresos
    del mes, Ingresos del mes (all real, computed for the current calendar
    month), "Locales por estado de pago" pie chart, "Últimos pagos"/"Últimos
    egresos" panels. Still mock: the "Ingresos mensuales" bar chart (+ its
    breakdown list) — hardcoded 6-month sample data, not wired to real pagos
  - **Locales**: full CRUD incl. delete (gear icon → dropdown menu on the
    detail page, `ConfirmDialogService` confirmation, admin-only via RLS),
    image upload to Storage, local detail page (editable, shows payment
    history), a `rif` text field (see `numero_local`/`rif` — two different
    things: `rif` is the plain text field on `locales`, while the "RIF" file
    upload under "Datos avanzados" is a separate scanned-document upload in
    `documentos`), and "Datos avanzados" to upload contrato/RIF/otro documents
    to a private Storage bucket
  - **Pagos de alquiler**: transactions with tipo de tasa (BCV/EUR/USD/otra);
    full edit support via the same modal in edit-mode (prefilled, "Guardar
    cambios"), same edit-icon pattern as Egresos/Caja chica
  - **Egresos**: transactions split into administrativo / operativo, plus a
    combined total view (tabs order: Total, Gastos administrativos, Gastos
    operativos); full edit support
  - **Caja chica**: ingreso/retiro ledger with a live running balance; full
    edit support
  - **Calculadora**: BCV + paralelo rates from dolarapi.com, USDT from Binance
    P2P, fetched and cached once per day by the `tasas-cambio` Edge Function
    into the `tasas_cambio` table
- Sidebar is collapsible on desktop (chevron toggle below the logo, icon-only
  rail at 76px, state persisted in `localStorage`); unchanged on mobile
  (<900px), which still uses the hamburger/overlay pattern
- Next steps: wire the "Ingresos mensuales" chart to real data, role-based UI
  restrictions for subadmin, delete support for pagos/egresos/caja_chica
  (RLS already allows it — only the UI is missing, follow the locales gear-menu
  pattern), `reportes` module, `servicios_pagos` and `remodelaciones` tables
