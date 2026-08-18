// The B2B service layer — DB-backed trade logic shared by the api-rest routes and
// the MCP tool registry (one service, many transports). Namespaced per domain to
// mirror the CRM/commerce service barrels.

export * as pricingTierService from './pricing-tiers.js';
export * as accountService from './accounts.js';
export * as approvalService from './approval.js';
export * as invoiceService from './invoices.js';

export { resolvePrimaryPropertyId } from './context.js';
export type { B2bContext } from './context.js';
export type { PendingEvent } from './events.js';

// Re-export the shared zod schemas so the REST routes parse against the SAME
// contracts the service does (one source of truth for the request shapes).
export {
  ListTiersQuery,
  TierBody,
  TierPatchBody,
  TierOverrideBody,
  TierOverridePatchBody,
} from './pricing-tiers.js';
export {
  AccountListQuery,
  AccountPatchBody,
  AccountOverrideBody,
  AccountOverridePatchBody,
  FleetVehiclesBody,
  CompatibleProductsQuery,
} from './accounts.js';
export {
  ApprovalRuleBody,
  ApprovalRulePatchBody,
  ApprovalQueueQuery,
  ApproveBody,
  RejectBody,
} from './approval.js';
export {
  InvoiceListQuery,
  InvoiceCreateBody,
  InvoiceUpdateBody,
  InvoiceMarkPaidBody,
  InvoiceWriteOffBody,
} from './invoices.js';
