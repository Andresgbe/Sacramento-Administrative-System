/**
 * Sidebar modules the admin principal can switch on and off. `id` is the
 * route path and the `modulos_config.modulo` key.
 *
 * Dashboard is not here: it is where every redirect lands, including the one
 * out of a disabled module. Usuarios and Admin auditoría are not here either:
 * switching them off would lock the principal out of the switch itself.
 */
export const MODULOS_CONFIGURABLES = [
  { id: 'locales', label: 'Locales' },
  { id: 'pagos', label: 'Reporte de pagos' },
  { id: 'egresos', label: 'Reporte de egresos' },
  { id: 'servicios-basicos', label: 'Servicios' },
  { id: 'balance', label: 'Balance' },
  { id: 'calculadora', label: 'Tasas' },
  { id: 'reportes', label: 'Reportes' },
] as const;

export type ModuloId = (typeof MODULOS_CONFIGURABLES)[number]['id'];
