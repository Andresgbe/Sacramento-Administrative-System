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
- Typography (`src/app/styles/_typography.scss`):
  - `--font-body` — Inter (general text, UI, body copy)
  - `--font-heading` — Plus Jakarta Sans (headings/titles)
  - **`--font-amount` — every money figure in the app.** Currently Plus Jakarta
    Sans: numbers get more presence than in the body face. It covers the big
    total cards, `.data-table__amount` cells, card rents, the "Depositó /
    Faltan" lines, bolívar sub-lines, chart values and dashboard stats. The
    variable used to be called `--font-mono` and aliased `--font-body`, which
    is why nothing here is monospaced. **Any new amount uses this variable** —
    never hard-code a face on a figure.
- **Number formatting is Venezuelan, not US**: `.` as the thousands separator,
  `,` as the decimal one (`2.850,00`, `2.735.054,40 Bs`). The app's `LOCALE_ID`
  is set to `es-VE` in `app.config.ts` (with `registerLocaleData` for
  `@angular/common/locales/es-VE`), so every Angular `number`/`currency`/`date`
  pipe picks this up automatically — **never pass a hardcoded locale like
  `'en-US'` to a pipe or to `toLocaleString`/`Intl.NumberFormat`**, and don't
  format a money figure by hand (string concatenation, manual grouping) instead
  of the pipe or `toLocaleString('es-VE', …)`.
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
  — the button system. **Tinted**: soft fills in each button's own intent
  colour, with exactly one solid fill (the primary) and **no coloured drop
  shadows** anywhere. Chosen because the table's edit/delete icon circles were
  already tinted — this extends that vocabulary instead of running a second one
  beside it. Two deliberate exceptions, both load-bearing:
  - `.btn--secondary` and `.btn--ghost` keep a **border**. A bare tint read as
    a disabled block on the white modal surfaces where every "Cancelar" lives.
  - `.btn--danger` stays **solid red**. It is only ever the confirm button of
    the destructive confirm dialog, where the final action should carry the
    most weight on screen — the tinted red treatment belongs to
    `.data-table__delete` and `.filters-clear` instead.

  Never add a coloured shadow or a second solid fill to a new button.

- **`.data-table-wrapper` / `.data-table` / `.data-table__amount` /
  `.data-table__actions` / `.data-table__edit`** — the transaction-table system.
  Gives every table (Pagos, Egresos, Balance, Servicios, and the local detail page's
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
  th/td/row styling locally. Put `class="data-table__amount"` on every money
  `<td>`: it applies `--font-amount` and stops the figure wrapping.
- **Directives in `src/app/shared/directives/`**: `appSelectOnFocus` (selects
  the field's value on focus, so typing over a `0`-default number input
  overwrites instead of prepending) and `appPositiveDecimal` (blocks `e`/`E`/
  `+`/`-` keys, since `type="number"` otherwise accepts scientific notation)
  — both applied to **every** currency "monto" input across the app (pagos,
  egresos, servicios, locales' `montoAlquiler`, calculadora). Apply both to
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
  every report table (Pagos, Egresos, Balance, Servicios). It's a white card whose
  fields sit on a **CSS grid** (`repeat(auto-fit, minmax(min(190px, 100%), 1fr))`),
  not flex-wrap: wrapped flex items kept their own widths and left ragged gaps,
  which is what made the bar look tangled on phones. Search spans two columns
  where there's room. Add a new filter as one more `.filters-field` — it lands
  in the grid automatically, no width tuning needed. `.filters-clear` is
  **always rendered** and `[disabled]="!hasActiveFilters()"` — never wrap it in
  an `@if`: it used to vanish the moment it did its job, which read as the
  button deleting itself, and it reflowed the grid on every click.
- **`<app-period-filter>`** (`src/app/shared/components/period-filter/`) —
  the Año + Mes filter pair, used by every report page (Pagos, Egresos,
  Balance, Servicios). They are two **independent** selects, not one
  `<input type="month">`, so "todo 2026" and "todos los septiembres" are both
  expressible; `''` means "todos" on either. The host is `display: contents`
  so its two `.filters-field` children land as direct grid items of
  `.filters-bar` instead of sharing one cell. Ships with three helpers used
  alongside it — `availableYears(fechas)` (years present in the data, newest
  first, plus the current one), `matchesPeriod(fecha, anio, mes)` for the
  filter predicate, and `currentYear()` / `currentMonth()` for the default
  signals. Any new report page filters its dates through these, never by
  hand-rolling `fecha.startsWith(...)`.
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
- Local's `numeroLocal` (e.g. "PB-D") stays out of the Pagos and Egresos
  **tables**, which show only the empresa name. It does appear
  wherever a specific unit has to be told apart from its siblings — the pago
  form's local dropdown, the Pagos local filter, and the Dashboard's morosos
  list all render `Empresa — PB-D`, because a company with two units would
  otherwise show two identical entries.

## Database (PostgreSQL via Supabase)

Implemented (migration + RLS in `supabase/migrations/`): usuarios, empresas,
locales, pagos, deudas, facturas_servicio, facturas_servicio_fotos, documentos,
tasas_cambio, egresos. Not built: `remodelaciones`.

- `caja_chica` still exists in the database but **nothing reads it**: the Caja
  chica module was removed in favour of Balance. Drop the table only on an
  explicit decision — the rows are real history.

- The `servicios_pagos` table from the original plan was never built and is not
  coming: its job is now split between `facturas_servicio` (the provider's
  monthly bill) and `deudas` (what each empresa owes).
- **Every new table needs its RLS policies in the same migration.** RLS with no
  policy denies everything, and it fails only at runtime with "new row violates
  row-level security policy" — `facturas_servicio` shipped that way once.
- Migrations are applied by pasting SQL into the Supabase SQL Editor, which
  wraps the whole script in one transaction. Guard DDL (`if not exists`,
  `drop policy if exists`, `do $$ ... $$` around `create type`) so a re-run is
  harmless, and run it with the live app closed — `alter table` takes an
  exclusive lock and has deadlocked against the running frontend before.

### empresas vs locales

A business can rent more than one unit in the mall, so the two are separate:

- **`empresas`** owns the business identity — `nombre_comercial`, `rif`,
  `imagen_url` (logo), `estado` (activo/inactivo/vencido), and its
  `documentos` (contrato/RIF scans hang off `documentos.empresa_id`).
- **`locales`** owns only the physical unit — `numero_local`, `piso`,
  `area_m2`, `monto_alquiler` — plus `empresa_id`.
- Logos still upload to the Storage bucket named `locales` (renaming it would
  break the public URLs already stored on existing rows).
- The Dashboard's "Empresas activas" tile counts `empresas`, not `locales` —
  that mismatch is what drove the split.
- **`empresas.es_propietaria`** marks Inmobiliaria Di Placido, which owns the
  mall and collects the rents. It is an `empresas` row only because it absorbs
  a share of the Corpoelec and Hidrocapital bills, so debts must be assignable
  to it. It is **not a tenant**: excluded from "Empresas activas", and offered
  in the pago/deuda empresa picker only for `corpoelec` and `hidrocapital` —
  it pays itself neither canon nor condominio. Exactly one row carries the
  flag; the empresa form never writes it.
- The Locales grid is sorted by empresa, then by `numero_local` with
  `localeCompare(..., { numeric: true })` so a company's units sit together and
  "PB-2" precedes "PB-10". Sorted in `LocalesService`, not the query: PostgREST
  orders the embedded empresa, not the parent rows.

### Payment concepts (`pagos.concepto`)

Every business pays **four** different things, and they are not billed at the
same level — this is why `pagos` carries both `empresa_id` and `local_id`:

| concepto           | billed per                             | `empresa_id` | `local_id` |
| ------------------ | -------------------------------------- | ------------ | ---------- |
| `canon` (alquiler) | **local** — 2 units = 2 canons a month | required     | required   |
| `condominio`       | **nobody** — one lump sum for the mall | null         | null       |
| `corpoelec`        | empresa — its share of a shared bill   | required     | null       |
| `hidrocapital`     | empresa — idem                         | required     | null       |

`empresa_id` is **nullable** because of condominio: it is collected as a single
monthly figure and is not broken down per tenant, so it has no business and no
unit. The check constraint `pagos_local_matches_concepto` enforces the whole
table above — both columns, per concepto — so nothing can land without the
reference it should have. `requiereEmpresa()` in `pago.model.ts` is the
front-end half of the same rule.

- A pago carries **two amounts**: `monto` (USD) and `monto_bs` (nullable). For
  **canon**, USD is authoritative — rent status, every total and the dashboard
  compare against `locales.monto_alquiler`, which is in dollars. `monto_bs`
  records what actually left the tenant's account, since the bank reference is
  in bolívares; it is never an input to a calculation. Null when paid in cash
  dollars. Both are typed by hand, so the rate is implicit in the pair — don't
  add a stored rate to `pagos`.
  **Condominio/Corpoelec/Hidrocapital flip this**: the mall collects these in
  bolívares, so `monto_bs` is the one typed by hand (required in the form —
  `PagoFormModal.esServicio()`), and `monto` (USD) is computed automatically
  from that day's BCV rate at submit time, purely to satisfy the NOT NULL
  column — it is never read back for display. Every USD figure shown for a
  service pago (the row, and the "Total cobrado en servicios" card in
  Servicios) is instead a **live** conversion of `monto_bs` at _today's_ BCV
  rate, marked with "≈", and changes as the rate does — a deliberate
  divergence from `deudas`' frozen-rate snapshot, chosen because these are
  live conversions for display, not a debt balance meant to stay stable.
- A check constraint (`pagos_local_matches_concepto`) enforces the table above,
  because "which local is this water bill for?" has no correct answer. Add a
  new per-unit concept to `CONCEPTOS_POR_LOCAL` in `pago.model.ts` **and** to
  that constraint, or inserts will be rejected.
- **Rent status has three states**, not two (`PagoStatus` in `local.model.ts`,
  computed by `PagosService.estadoPago(localId, montoAlquiler)`):
  `al-dia` · `parcial` · `debe`. It sums the month's **canon** payments for the
  unit and compares them against the local's `montoAlquiler` — a tenant who
  paid $1.000 of a $1.152 canon is neither up to date nor simply owing, and
  showing them as "Al día" was a real bug. `faltantePorPagar()` gives the
  outstanding amount, shown on the card, the detail page and the Dashboard pie.
  Only canon counts: a company can be current on its water bill and still owe
  rent. With no `montoAlquiler` on record it falls back to paid/unpaid, since
  there is nothing to compare against.
- **Income vs pass-through splits the screens.** `CONCEPTOS_DE_INGRESO`
  (`canon` + `condominio`) is the mall's own money and lives in **Reporte de
  pagos**, which has tabs Todos / Canon / Condominio. `corpoelec` and
  `hidrocapital` are collected and forwarded and live in **Servicios**. One
  table, two pages: each passes `conceptosPermitidos` to the shared
  `<app-pago-form-modal>`, so neither can write the other's rows.
- **Everything that sums income filters through `esConceptoDeIngreso()`** —
  the Dashboard tiles, the "Ingresos mensuales" chart, "Últimos pagos", and
  Balance. Never hard-code `concepto === 'canon'` for an income total again:
  that is exactly what had to be changed in five places when condominio moved.
  The one deliberate canon-only filter left is `canonPagadoEsteMes()`, because
  rent status must not be satisfied by a condominio payment.

### deudas y facturas de servicio

`pagos` records money that came IN. `deudas` records what is OWED — that is what
the monthly "Estado de cuenta" is, and unpaid obligations carry across months
(a tenant can owe condominio for both August and September). Balance for a
business = its `deudas` minus the `pagos` linked to them (`pagos.deuda_id`).

- **`facturas_servicio`** — one provider bill per service per month, plus its
  scans in `facturas_servicio_fotos`. Corpoelec and Hidrocapital arrive as ONE
  bill covering a shared meter, then get split among the businesses on it;
  there is more than one electricity account, each shared by a different set of
  companies. **The split percentages are entered per bill, never stored** — the
  mall confirmed the proportions change month to month.
- **`deudas`** — one row per empresa / concepto / period, with `factura_id` set
  when it is one company's share of a shared bill, and null for canon and
  condominio which are billed straight to the business. Mirrors `pagos`: a
  check constraint requires `local_id` for canon and forbids it otherwise.
- **`deudas.moneda`** — services in `VES`, canon and condominio in `USD`. The
  estado de cuenta reports the two totals **side by side and never sums them**,
  which is how the mall's own PDF reads. The rate a debt was converted at is
  snapshotted on the row, not joined live from `tasas_cambio`: otherwise a past
  month's debt would move every time the dollar does.

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
│   ├── balance/
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
  Every table follows the same shape: **all authenticated users read, only
  admin writes** (insert, update and delete) — `20260821000000` tightened
  inserts to admin too, so subadmins are effectively read-only. A subadmin
  clicking a write action gets a Supabase error surfaced in the UI, by design,
  until role-based UI gating is built
- The sidebar modules are built and wired to real Supabase data:
  - **Dashboard**: fully live — Balance del mes, Empresas activas, Egresos
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
  - **Reporte de pagos**: tabs per concepto (Todos / Canon / Condominio /
    Corpoelec / Hidrocapital) with the total recomputed per tab, plus filters
    for search, año, mes, monto range, empresa and local (the last two are
    `<app-multi-select>`). Columns: ID, fecha, concepto chip, empresa, local
    (`—` for empresa-wide concepts), monto, tasa, comprobante. Full edit and
    delete. The form picks concepto first; the Local field only appears for
    canon and lists just that empresa's units
  - **Egresos**: transactions split into administrativo / operativo, plus a
    combined total view (tabs order: Total, Gastos administrativos, Gastos
    operativos); full edit support
  - **Balance** (`/balance`): three cards — Ingresos, Egresos and the Balance
    between them — over a single list of the period's movements, both sides
    together, newest first, with a green/red chip and a signed amount.
    Read-only: every row is registered in Reporte de pagos or Reporte de
    egresos and is edited there. Defaults to the current month.
    **Canon only on the income side, and servicios excluded entirely**:
    condominio, Corpoelec and Hidrocapital are collected and forwarded, and the
    forwarding already appears as an egreso, so including them would have each
    cancel against itself and make the balance meaningless.
    **Caja chica was removed** — the module, its service, model and modal are
    gone. The `caja_chica` table is still in the database, untouched, pending a
    decision on whether to drop it.
  - **Servicios** (`/servicios-basicos`, sits **directly below Reporte de
    pagos** in the sidebar, since the two are the twin halves of what a tenant
    pays). Two top-level tabs:
    - **Facturas del mes** — the provider bills archive described below.
    - **Pagos de las empresas** — what each business paid for condominio,
      Corpoelec and Hidrocapital, with its own total. These are `pagos` rows
      like any other; the page just filters `concepto <> 'canon'` and hands
      `<app-pago-form-modal>` the three service concepts.
      The bills half records each month's bill for condominio, Corpoelec and
      Hidrocapital. One row per bill in `facturas_servicio`, with tabs per
      service and the shared año/mes filter. Each bill carries **several photos**
      (`facturas_servicio_fotos`) because a month's bill arrives as multiple
      pages — the Corpoelec sheets come in two parts. Files go to the existing
      private `documentos` bucket under `facturas/<factura_id>/`, same
      arrangement as pago comprobantes, so no new bucket or storage policy.
      Deleting a bill removes its Storage objects first: the DB rows cascade,
      the files don't.
      The module is an **archive, not an amount ledger** — the form asks only
      for service, month, year and photos. It deliberately carries **no amount,
      currency or exchange rate**: the figures live inside the attached
      documents, and the per-empresa numbers belong in `deudas`. Don't reinstate
      a total here — it would be a second place for the same number to drift.
  - **Reportes** (`/reportes`): every pago and egreso flattened into one
    searchable list — four summary cards (Ingresos, Egresos, Balance, count),
    filters for search, año, mes, tipo and empresa (both `<app-multi-select>`)
    and a monto range, plus **Excel** and **PDF** buttons that export exactly
    the rows currently on screen. Read-only; nothing is registered here.
    Both libraries are **`import()`ed inside the click handler**, never at the
    top of the file: together they are ~900 kB, dwarfing the page itself, and
    most visits download nothing. Keep it that way — a static import would drag
    them into the route's main chunk.
    In the **.xlsx**, amounts are written as real numbers, not preformatted
    strings, so the client can sum and pivot them; that is the whole reason for
    shipping Excel over a CSV. The **PDF** is landscape (nine columns do not
    fit portrait) and drawn with `jspdf-autotable`.
    `xlsx` is installed **from `cdn.sheetjs.com`, not npm** — the npm `xlsx`
    package is frozen at 0.18.5 with known CVEs. Don't "fix" it to the registry
    version. jsPDF pulls `canvg`/`html2canvas` (CommonJS, unused by us), which
    is why `allowedCommonJsDependencies` exists in `angular.json`.
    Egreso rows carry no recorded bolívar figure, so their Bs column is a live
    BCV conversion flagged `≈` in the table and with a "Bs estimado" column in
    the CSV; pago rows show their real `monto_bs` unflagged.
  - **Calculadora**: BCV + paralelo rates from dolarapi.com, USDT from Binance
    P2P, fetched and cached once per day by the `tasas-cambio` Edge Function
    into the `tasas_cambio` table
- Sidebar is collapsible on desktop (chevron toggle below the logo, icon-only
  rail at 76px, state persisted in `localStorage`); unchanged on mobile
  (<900px), which still uses the hamburger/overlay pattern
- Next steps, in order:
  1. **The split screen** — pick a `facturas_servicio` row and enter what each
     empresa owes, writing the `deudas` rows. Nothing writes `deudas` yet.
  2. **Estado de cuenta per empresa** — unpaid `deudas` grouped by concepto and
     period, with the bolívar and dollar totals separate, replicating the PDF
     the mall sends its tenants today.
  3. Linking a `pago` to the `deuda` it settles (`pagos.deuda_id` exists and is
     never written), so a balance can be computed.
  4. Role-based UI restrictions for subadmin — today only RLS enforces it, so a
     subadmin sees buttons that fail with a Supabase error.
  5. `remodelaciones` table.

## Working with the client's documents

The mall sends scanned PDFs (Corpoelec/Hidrocapital bills, estados de cuenta).
The Read tool returns only metadata for them, but **`pypdf` extracts the text
fine** — `python -c "import pypdf; ..."`. `pdftoppm` is not installed, so page
rasterising is unavailable. Read the bills before designing around them: they
are where facts like "there are two Corpoelec accounts with different member
sets" actually came from.
