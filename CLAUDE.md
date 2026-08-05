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
- Angular project restarted from scratch (previous frontend discarded)
- PostgreSQL schema already defined
- Next steps: RLS policies for admin/subadmin, Angular folder structure,
  TypeScript models aligned with the schema, real login connected to Supabase Auth
