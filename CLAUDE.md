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
  but the UI doesn't yet restrict subadmin actions — only RLS enforces it today
- All 6 sidebar modules are built and wired to real Supabase data:
  - **Dashboard**: live — caja chica balance, "Locales por estado de pago" pie
    chart (al día / morosos, computed from PagosService), "Últimos pagos" and
    "Últimos egresos" panels. Still placeholder: Locales activos/vencidos stats
    and the "Ingresos mensuales" bar chart
  - **Locales**: full CRUD, image upload to Storage, local detail page
    (editable, shows payment history), "Datos avanzados" section to upload
    contrato/RIF/otro documentos to a private Storage bucket
  - **Pagos de alquiler**: transactions with tipo de tasa (BCV/EUR/USD/otra)
  - **Egresos**: transactions split into administrativo / operativo, plus a
    combined total view
  - **Caja chica**: ingreso/retiro ledger with a live running balance
  - **Calculadora**: BCV + paralelo rates from dolarapi.com, USDT from Binance
    P2P, fetched and cached once per day by the `tasas-cambio` Edge Function
    into the `tasas_cambio` table
- Next steps: wire the remaining dashboard placeholders, role-based UI
  restrictions for subadmin, `reportes` module, `servicios_pagos` and
  `remodelaciones` tables
