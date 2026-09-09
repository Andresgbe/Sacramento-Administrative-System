# CC Sacramento

## Project

- Name: CC Sacramento (Centro Comercial Sacramento, Carrizal, Venezuela)
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

### Shared UI utilities

Reuse these instead of duplicating CSS per feature; every transaction list and
every tab set in the app already uses them. Class-based entries live in
`src/styles.scss` (global, not component-scoped); the rest are components,
directives and services under `src/app/shared/`.

- **`.btn` + `.btn--primary` / `.btn--secondary` / `.btn--ghost` / `.btn--danger`**
  — base button system.
- **`.data-table-wrapper` / `.data-table` / `.data-table__amount` /
  `.data-table__actions` / `.data-table__edit`** — the transaction-table system.
  Gives every table (Pagos, Egresos, Caja chica, and the local detail page's
  "Historial de pagos") the same look: white card wrapper, uppercase muted
  header, **light grey (`--color-surface-muted`) row background**, a right-hand
  action column with a circular pencil "edit" icon button, and left-aligned
  amount cells (deliberately _not_ right-aligned — a past attempt at
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
- **`<app-tabs>`** (`src/app/shared/components/tabs/`) — the app's ONE switch /
  tab style. Underlined text tabs: no container, no pill, no background — the
  active tab is `--color-text-primary` with a 2px `--color-accent` bottom
  border, inactive ones are `--color-text-secondary`, sitting on a shared 1px
  `--color-border` baseline. Chosen over the segmented-pill control it replaced,
  which put a grey active pill on a white track and read as disabled.
  Generic and presentational:
  ```ts
  protected readonly tabItems: TabItem<MiUnion>[] = [{ id: 'a', label: 'A' }];
  ```
  ```html
  <app-tabs [tabs]="tabItems" [active]="tab()" (selected)="setTab($event)" />
  ```
  `T` is inferred from `tabs`, so `$event` keeps the caller's union type.
  Used by Locales (Locales/Empresas) and Egresos (Total/administrativos/
  operativos). **Every new switch or tab set uses this component** — never
  hand-roll tab markup or a pill/segmented control in a feature's SCSS.
- **`.filters-bar` / `.filters-field` / `.filters-field--search` /
  `.filters-field__amount-row` / `.filters-clear`** — the filter card above
  every report table (Pagos, Egresos, Caja chica). It's a white card whose
  fields sit on a **CSS grid** (`repeat(auto-fit, minmax(min(190px, 100%), 1fr))`),
  not flex-wrap: wrapped flex items kept their own widths and left ragged gaps,
  which is what made the bar look tangled on phones. Search spans two columns
  where there's room. Add a new filter as one more `.filters-field` — it lands
  in the grid automatically, no width tuning needed.
- **`<app-multi-select>`** (`src/app/shared/components/multi-select/`) — the
  checkbox dropdown used for the Empresa and Local filters in Pagos. Takes
  `options` (`{ id, label }[]`), the current `selected` `Set<string>`,
  `allLabel` ("Todas las empresas") and `countLabel` ("empresas seleccionadas"),
  and emits a **new** `Set` on `selectionChange` — never mutate the one passed
  in, or the signal won't see the change. Reuse it for any future multi-value
  filter instead of rebuilding a trigger + panel + backdrop.
- **`ConfirmDialogService`** (`src/app/shared/services/confirm-dialog.service.ts`)
  - `<app-confirm-dialog>` (mounted once in `app.html`, available app-wide) —
    the app's custom replacement for `window.confirm()`. Inject the service and
    `await confirmDialog.confirm({ title, message, confirmLabel, danger: true })`
    before any destructive action (currently used by local deletion). Never use
    the native browser `confirm()`/`alert()` — it was explicitly rejected as
    looking out of place.
- Local's `numeroLocal` (e.g. "PB-D") stays out of the Pagos, Egresos and
  Caja chica **tables**, which show only the empresa name. It does appear
  wherever a specific unit has to be told apart from its siblings — the pago
  form's local dropdown, the Pagos local filter, and the Dashboard's morosos
  list all render `Empresa — PB-D`, because a company with two units would
  otherwise show two identical entries.

## Database (PostgreSQL via Supabase)

Tables: usuarios, empresas, locales, pagos, servicios_pagos, egresos, caja_chica,
remodelaciones, tasas_cambio, documentos

- Implemented (migration + RLS in `supabase/migrations/`): usuarios, empresas,
  locales, pagos, documentos, tasas_cambio, egresos, caja_chica

### empresas vs locales

A business can rent more than one unit in the mall, so the two are separate:

- **`empresas`** owns the business identity — `nombre_comercial`, `rif`,
  `imagen_url` (logo), `estado` (activo/inactivo/vencido), and its
  `documentos` (contrato/RIF scans hang off `documentos.empresa_id`).
- **`locales`** owns only the physical unit — `numero_local`, `piso`,
  `area_m2`, `monto_alquiler` — plus `empresa_id`.
- **`pagos.local_id` is unchanged**: rent is charged per unit, so a company
  with two locales pays two rents and each unit has its own "al día / moroso"
  status.
- Logos still upload to the Storage bucket named `locales` (renaming it would
  break the public URLs already stored on existing rows).
- The Dashboard's "Empresas activas" tile counts `empresas`, not `locales` —
  that mismatch is what drove the split.
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
    egresos" panels, and the "Ingresos mensuales" bar chart (+ its breakdown
    list) — last 6 calendar months, summed from real pagos
  - **Locales**: two tabs — "Locales" (the card grid, one card per unit; the
    logo, name and estado badge come from the empresa join) and "Empresas"
    (a `.data-table` list with logo, RIF, estado and a locales count, plus
    add/edit/delete). Full CRUD on both, delete confirmed through
    `ConfirmDialogService` and admin-only via RLS. Adding a local means picking
    an empresa from a dropdown. Empresa deletion is blocked while it still has
    locales assigned. The empresa form owns the logo upload and "Datos
    avanzados" (contrato/RIF/otro documents to a private Storage bucket) —
    note `rif` is a plain text field on `empresas`, while the "RIF" file upload
    is a separate scanned document in `documentos`
  - **Reporte de pagos**: transactions with tipo de tasa (BCV/EUR/USD/otra);
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
- Next steps: role-based UI restrictions for subadmin, delete support for
  pagos/egresos/caja_chica (RLS already allows it — only the UI is missing,
  follow the locales gear-menu pattern), `reportes` module, `servicios_pagos`
  and `remodelaciones` tables
