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

## Exchange rates — three different dollars

The app handles **three** dollars and they are different numbers for the same
money. **Never write "$" or "USD" on a figure without saying which one it is.**
A bare dollar sign on a screen is a bug: label it, and let
`<app-monto-equivalencias>` restate it in the others.

| Rate | Where it comes from | What it is |
| --- | --- | --- |
| **USDT/Cash** | `tasas_cambio.usdt` — Binance P2P sell ads | The parallel dollar. **The app's unit of account.** |
| **BCV** | `tasas_cambio.bcv` — dolarapi.com `oficial` | The official rate. A second reading, never a total. |
| **Euro** | `tasas_cambio.paralelo` is *not* this; the euro is only a `tipoTasa` option on a pago | Recorded per payment when the tenant paid against the euro. |

- **USDT/Cash is the unit of account.** Every `monto` stored anywhere —
  `pagos.monto`, `egresos.monto`, `locales.monto_alquiler` — is already a
  USDT/Cash dollar. No stored figure is ever re-valued by a rate; rates only
  answer "how many bolívares is that" and "what would that be at BCV".
- **Use `usdt`, not `paralelo`.** `tasas_cambio` carries both. The P2P book is
  the market the money actually changes hands in; `paralelo` is an average of
  monitors quoting it. They are close, but only one of them is the rate the
  mall transacts at, and mixing them makes two totals disagree by a few
  bolívares for no reason anyone can explain.
- **The conversions live in `TasasCambioService`, nowhere else** —
  `usdtCash()`, `bcv()`, `aBolivares(monto)` and `aDolaresBcv(monto)`. Don't
  multiply by a rate inline in a component: that is how a second, divergent
  rule gets written. Egresos used to convert at BCV inline and understated
  every row by the gap between the two rates.
- `pagos.tipo_tasa` (`BCV` / `EUR` / `USD` / `otra`, where `USD` is labelled
  **USDT/Cash**) records which rate that particular payment was settled
  against. It is a record of the transaction, not an input to any total.

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
- **`<app-monto-equivalencias>`**
  (`src/app/shared/components/monto-equivalencias/`) — the two lines that sit
  under every big money figure: `≈ … Bs` and `≈ $ … a tasa BCV`, both derived
  from the USDT/Cash amount above them at today's rates, both marked `≈`.
  Takes one input, `monto`, and reads `TasasCambioService` itself rather than
  taking the rates as inputs — the conversion is one rule for the whole app.
  Its host is `display: contents`, so the two lines land as direct children of
  whatever card flex column it was dropped into. Used by every total card:
  Dashboard's four tiles, Reporte de pagos, Reporte de egresos and Balance's
  three. **Any new money card gets it**, plus a `.monto-moneda` tag naming the
  rate — never a bare figure, and never a hand-rolled `monto * bcv` sub-line.
  The page that mounts it must `load()` the rate service; the component does
  not fetch.
- **`.monto-moneda`** (`src/styles.scss`) — the small uppercase pill that names
  the rate a figure is in ("USDT/Cash", "Nominal"). Goes on every big money
  figure, because the app has three dollars and `$ 467,01` alone is ambiguous.
- **`.btn--sm`** — size modifier on the button system, for a button inside a
  table row where the default padding would set the row height.
- **`<app-comprobante-preview-modal>`
  (`src/app/shared/components/comprobante-preview-modal/`) — opens a receipt
  from the private `documentos` bucket. Takes `nombreArchivo`, a signed `url`,
  `loading` and `errorMessage`; the caller fetches the signed URL. Used by both
  Reporte de pagos and Reporte de egresos — it lived under `features/pagos/`
  until the second caller appeared.
- **`<app-multi-select>`** (`src/app/shared/components/multi-select/`) — the
  checkbox dropdown used for the Empresa and Local filters in Pagos. Takes
  `options` (`{ id, label }[]`), the current `selected` `Set<string>`,
  `allLabel` ("Todas las empresas") and `countLabel` ("empresas seleccionadas"),
  and emits a **new** `Set` on `selectionChange` — never mutate the one passed
  in, or the signal won't see the change. Reuse it for any future multi-value
  filter instead of rebuilding a trigger + panel + backdrop.
- **Modal width — `--modal-width` (760px), the same for every modal.**
  Declared in `src/app/styles/_variables.scss`; each modal's `.modal` sets
  `max-width: var(--modal-width)`. It was 480px, which wasted the desktop
  viewport and forced every form into one column that had to be scrolled.
  **A new modal uses the variable, never its own number.** Every modal in the
  app already does; only the pago form has had its *fields* re-laid out for
  the extra room so far, the rest still stack as they did.
  Inside a modal, fields pair up with `.field-row` (a two-column grid) rather
  than stacking, now that there is room for it.
- **`.upload-zone` + `.upload-list`** (`src/styles.scss`) — **the** file
  attachment pattern. A dashed block with an upload glyph, a title and a hint,
  followed by one row per file with its name and an `✕` to remove it. Files
  picked but not yet uploaded carry a "Nuevo" badge, because removing one of
  those costs nothing while removing a stored one deletes it for good. It
  replaced a one-line "Subir comprobante" link that sat last in the form and
  was the easiest thing to miss. **Every new file field uses this** — never a
  bare `<input type="file">` or another dropzone.

  Markup (lives inside a `.field`, so the `<span>` is the label):

  ```html
  <div class="field">
    <span>Comprobante de pago</span>

    <label class="upload-zone">
      <input type="file" accept="image/*,.pdf" multiple
             (change)="onComprobantesSelected($event)" hidden />
      <span class="upload-zone__icon" aria-hidden="true">&#128228;</span>
      <span class="upload-zone__title">Subir comprobantes</span>
      <span class="upload-zone__hint">Imágenes o PDF · puedes anexar varios</span>
    </label>

    @if (comprobantesExistentes.length > 0 || comprobanteFiles.length > 0) {
      <ul class="upload-list">
        <!-- Already stored: removing one deletes it for good. -->
        @for (c of comprobantesExistentes; track c.id) {
          <li class="upload-list__item">
            <span class="upload-list__name">{{ c.nombre }}</span>
            <button type="button" class="upload-list__remove"
                    (click)="removeComprobanteExistente(c)"
                    [attr.aria-label]="'Eliminar ' + c.nombre">&#10005;</button>
          </li>
        }
        <!-- Picked this session: not uploaded yet, hence the badge. -->
        @for (file of comprobanteFiles; track file.name + file.size) {
          <li class="upload-list__item upload-list__item--nuevo">
            <span class="upload-list__name">{{ file.name }}</span>
            <span class="upload-list__badge">Nuevo</span>
            <button type="button" class="upload-list__remove"
                    (click)="removeComprobanteFile(file)"
                    [attr.aria-label]="'Quitar ' + file.name">&#10005;</button>
          </li>
        }
      </ul>
    }
  </div>
  ```

  The three handlers behind it:

  ```ts
  protected comprobanteFiles: File[] = [];
  protected comprobantesExistentes: ComprobantePago[] = [];

  /** Emitted so the PAGE deletes it through the service — the modal owns no
   *  data access of its own (smart/dumb). */
  @Output() comprobanteEliminado = new EventEmitter<ComprobantePago>();

  protected onComprobantesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Appended, not replaced: picking a second time should ADD to the list,
    // which is what "anexar varios" means to someone choosing one at a time.
    this.comprobanteFiles = [...this.comprobanteFiles, ...Array.from(input.files ?? [])];
    // Let the same file be picked again after being removed.
    input.value = '';
  }

  protected removeComprobanteFile(file: File): void {
    this.comprobanteFiles = this.comprobanteFiles.filter((f) => f !== file);
  }

  protected removeComprobanteExistente(c: ComprobantePago): void {
    this.comprobantesExistentes = this.comprobantesExistentes.filter((x) => x.id !== c.id);
    this.comprobanteEliminado.emit(c);
  }
  ```

  Two details that are load-bearing and easy to drop:
  - **`input.value = ''` after every pick.** Without it the browser suppresses
    the `change` event when the same file is chosen again, so re-adding a file
    you just removed silently does nothing.
  - **Append, don't replace.** `input.files` holds only the last pick, so
    assigning it straight to the list throws away everything chosen before.

  On the data side, several files per record means a child table (one row per
  file, `on delete cascade`), as `pagos_comprobantes` and
  `facturas_servicio_fotos` both do — not more columns on the parent. Deleting
  one removes the Storage object **first**: the DB row cascades, the file does
  not.
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
locales, pagos, pagos_comprobantes, deudas, facturas_servicio,
facturas_servicio_fotos, egresos_servicio, documentos, tasas_cambio, egresos.
Not built: `remodelaciones`.

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
  `PagoFormModal.esServicio()`), and `monto` (USD) is computed at submit time
  from that day's **USDT/Cash** rate. That computed figure is **real and is
  read back**: it is what these concepts contribute to every balance, since
  they need no manual conversion. It was computed at BCV once, which put a
  BCV dollar in a column that holds USDT/Cash everywhere else and overstated
  every service payment by the gap between the two rates.
  The USD figures *displayed* for a service pago (the row, and the "Total
  cobrado en servicios" card in Servicios) are a **live** conversion of
  `monto_bs` at _today's_ USDT/Cash rate, marked with "≈", and change as the
  rate does — a deliberate divergence from `deudas`' frozen-rate snapshot,
  chosen because these are live conversions for display, not a debt balance
  meant to stay stable.
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

### El formulario de pago

Laid out in rows of two, in this order — the sequence someone filling it in
actually thinks in, which the old single column did not follow:

1. **Concepto · Fecha**
2. **Empresa · Local** — the whole row disappears for condominio, which has
   neither.
3. **Monto (Bs) · Monto (USD)** — for canon. The Bs side is explicitly marked
   *Opcional* (a payment in cash dollars has no bolívar side). For the three
   service concepts this collapses to a single required **Monto (Bs)** plus
   its USDT/Cash equivalent (which is what gets stored) plus the BCV reading
   beside it, since those are collected in bolívares.
4. **Descripción**
5. **Comprobantes**

- **The rate select lives inside the amount input** (`.monto-combo`), not as
  a field of its own: "120 at BCV" is one statement, and as two separate
  fields the rate was routinely left on whatever the previous payment used.
  The wrapper carries the border and the focus ring; the input and the select
  are borderless inside it.
- **A pago can carry several comprobantes** — `pagos_comprobantes`, one row
  per file, same arrangement as `facturas_servicio_fotos`, because a payment
  arrives as the transfer slip plus the bank's confirmation often enough.
  `pagos.comprobante_ruta` / `_nombre` are **left on the table and backfilled
  from, not dropped**: dropping them would take the live rows' receipts with
  them if the migration ever had to be rolled back. Nothing reads them now.
  Removing an existing attachment deletes it immediately (Storage object
  first — the row does not cascade to the file); the modal emits
  `comprobanteEliminado` and the page calls the service, so the modal keeps
  no data access of its own.

### Conversión a USDT — qué cuenta como ingreso

**A payment arriving is not income yet.** The bolívares sit in the account
until somebody goes to the market and buys USDT with them, and what the mall
ends up with is never exactly the nominal figure — the rate moved, the
exchange took a cut. So the amount that counts is the one that came back.

- **`pagos.usdt_convertido`** holds the USDT actually bought with that
  payment, with `conversion_fecha` and an optional
  `conversion_comprobante_ruta` / `_nombre` (its own `conversiones/<pago_id>/`
  folder in the `documentos` bucket — a different document from the payment's
  own comprobante). A check constraint keeps the amount and the date together:
  neither half means anything alone.
- **It is typed, never computed from a rate.** Deriving it would defeat the
  whole point, which is that what came back differs from the nominal amount.
- **Only canon needs the manual step** (`requiereConversionManual()`). Canon
  is agreed in dollars and arrives as dollars or as a transfer at whatever
  rate was agreed, so what the mall ends up holding is unknown until it
  actually buys USDT. **Condominio, Corpoelec and Hidrocapital are typed in
  bolívares and the form values them at that day's USDT/Cash rate on the
  spot** — `monto` is already the parallel figure, so they count immediately,
  have no "sin convertir" state, and show "Automática" in the Conversión
  column instead of a button. The **"Balance sin convertir" card is hidden on
  those tabs entirely** (`muestraSinConvertir()`), keyed on the concepto and
  not on the card reaching 0 — on Todos and Canon an empty queue is real
  information, and hiding it there would make the card vanish the moment it
  did its job, the same mistake `.filters-clear` made once.
- **Every income total goes through `montoRealizado(pago)`** in
  `pago.model.ts` — `monto` for the bolívar concepts, `usdt_convertido ?? 0`
  for canon. Reporte de pagos'
  "Total cobrado", the Dashboard tiles and "Ingresos mensuales" chart, Balance
  and Reportes' summary cards all use it. **Never sum `pago.monto` for a
  balance again**: that is the nominal figure, which the mall may not have
  realised yet. This is the same mistake as hard-coding `concepto === 'canon'`
  — one rule, one function.
- **`montoSinConvertir(pago)`** is the other half: the nominal value of what
  is still pending. It feeds the "Balance sin convertir" card beside "Total
  cobrado" in Reporte de pagos, which is a **queue of work, not money** —
  styled muted and dashed, tagged `Nominal` rather than `USDT/Cash`, and
  deliberately never added to any balance.
- **Rent status deliberately ignores all of this.** `canonPagadoEsteMes()`
  sums `monto`, because it answers "did the tenant pay?" — whether the mall
  converted the money is the mall's business, not the tenant's. Using the
  converted figure there would mark every tenant moroso until the admin got
  round to converting.
- Reportes' **export keeps both**: `Monto USD` stays nominal (it is a register
  of what came in) and a `USDT convertido` column carries the realised figure,
  which is what the summary rows total.
- Balance's movement list shows the realised amount, and tags an unconverted
  income "Sin convertir" — otherwise a `$ 0,00` row looks like a bug instead
  of money that has not been turned into USDT yet.

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
    month; every money tile is in **USDT/Cash**, tagged as such, with the
    bolívar and BCV restatements under it from `<app-monto-equivalencias>`,
    and income counts only what has been converted), "Locales por estado de pago" pie chart, "Últimos pagos"/"Últimos
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
    (`—` for empresa-wide concepts), monto, tasa, descripción, comprobante and
    **conversión**. Full edit and delete.
    Two cards in the header: **"Total cobrado"**, which counts only converted
    payments, and **"Balance sin convertir"** beside it, the nominal value
    still queued. The Conversión column carries a `Convertir` button on an
    unconverted row and, once converted, the USDT figure, its date, a link to
    the conversion receipt and `Editar` / `Anular`. Anular is confirmed
    through `ConfirmDialogService` and puts the row back in the queue. The form picks concepto first; the Local field only appears for
    canon and lists just that empresa's units
  - **Reporte de egresos**: transactions split into administrativo / operativo,
    plus a combined total view (tabs order: Total, Gastos administrativos,
    Gastos operativos); full edit and delete. Each row can carry a
    **comprobante** — same arrangement as pagos: the file goes to the private
    `documentos` bucket under `egresos/<id>/`, the row keeps `comprobante_ruta`
    - `comprobante_nombre`, and the table opens it through a signed URL with
      the shared `<app-comprobante-preview-modal>`. The total and each amount
      also show a bolívar figure at today's **USDT/Cash** rate, flagged `≈`:
      egresos have no recorded `monto_bs`, so it is a live conversion, not what
      left the account. It converted at BCV until the rate model changed, which
      understated every row by the gap between the two rates.
  - **Balance** (`/balance`): three cards — Ingresos, Egresos and the Balance
    between them, all in USDT/Cash with their bolívar and BCV restatements —
    over a single list of the period's movements, both sides together, newest
    first, with a green/red chip and a signed amount. Income counts only
    converted payments; an unconverted one shows 0 with a "Sin convertir" tag.
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
    - **Egresos de servicios** — what the mall pays the providers, in its own
      table `egresos_servicio`. A separate table rather than a `categoria` on
      `egresos`, for two reasons: it must stay **out of Balance and Reportes**
      (services are collected and forwarded, so counting them there would have
      each cancel against itself), and making that structural means nothing has
      to remember to filter it; and it is denominated in **bolívares**, the
      opposite of `egresos` where USD is authoritative. The form takes an amount
      in Bs **or** USD — a dollar figure is converted at that day's USDT/Cash
      rate (a typed dollar is a USDT/Cash dollar, like every other `monto`)
      and the rate is **frozen onto the row** (`monto_usd` + `tasa`), unlike the live
      conversions elsewhere on this page, because an expense on record must not
      drift when the dollar moves. The tab shows "Total egresado" and
      **"Saldo de servicios" = cobrado − egresado**, in Bs, which is the number
      that says whether the tenants' payments covered the providers' bills.
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
    USDT/Cash conversion flagged `≈` in the table and with a "Bs estimado"
    column in the CSV; pago rows show their real `monto_bs` unflagged. The
    summary cards total `montoRealizado`, so they count only converted income,
    while the rows keep the nominal `Monto USD` and carry the realised figure
    in a separate `USDT convertido` column.
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
