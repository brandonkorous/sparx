// sparx CRM — schema package barrel.
//
// Single source of truth for the shape of every Server Action / REST / MCP
// write into the CRM. The service layer (@wizeworks/crm) and Server Actions
// (apps/dashboard/app/(dashboard)/crm) both validate inputs against these
// Zod schemas before touching Prisma — keeping the JSONB and column writes
// type-safe across transports.

export * from './customers';
export * from './companies';
// When a wholesale account still needs its prices and terms set up (issue 080).
export * from './account-set-up';
export * from './object-defs';
export * from './associations';
export * from './engagement';
export * from './calls';
export * from './pipelines';
export * from './deals';
export * from './tickets';
export * from './reports';
export * from './scoring';
export * from './workspace';
export * from './activities';
export * from './tasks';
export * from './segments';
export * from './segment-rule';
export * from './evaluate-segment-rule';
export * from './orders';
export * from './order-payments';
export * from './order-fulfillments';
// Can this order, and this line, leave the building yet (persona issues 057, 058).
export * from './ship-gate';
export * from './invoicing';
export * from './common-commerce';
export * from './common';
