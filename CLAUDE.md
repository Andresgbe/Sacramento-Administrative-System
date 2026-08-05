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

## Working conventions
- All code and explanations in English
- Development environment: Windows, PowerShell, VS Code
- Prefer step-by-step progress: test each working piece before moving on
- The user wants to understand the backend architecture, not just copy/paste solutions

## Current status
- Angular project restarted from scratch (previous frontend discarded)
- PostgreSQL schema already defined
- Next steps: RLS policies for admin/subadmin, Angular folder structure,
  TypeScript models aligned with the schema, real login connected to Supabase Auth
