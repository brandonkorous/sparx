// sparx CRM — public package barrel.
//
// Re-exports the service layer plus the shared types REST/GraphQL/MCP
// transports use. Per the locked decision #7 (one service layer, three
// transports), every external write into the CRM goes through one of the
// services here.

export * from './services/index';
export { crmPresets, b2bPresets, invoicingPresets } from './presets';
export * from './events';
export * from './consumers/index';
export * as crmMcp from './mcp';
// Re-export the MCP tool array + types at the top level so transports can
// `import { crmMcpTools, type McpScope } from '@wizeworks/crm'` without the
// `crmMcp.` namespace prefix.
export { crmMcpTools } from './mcp';
export type { AnyMcpTool, McpScope, McpToolDefinition } from './mcp';
// Invoicing module tools (docs/87 §12) — a separate array with its own
// read:invoicing / write:invoicing scopes (the MCP server gates them on the
// `invoicing` module flag).
export { invoicingMcpTools } from './mcp';
export type { InvoicingMcpScope, InvoicingMcpTool } from './mcp';
export {
  WebhookFanoutPublisher,
  preconnectWebhookFanout,
  installCrmWebhookFanout,
} from './webhooks';
export * as crmSchedulers from './schedulers';
export type { ServiceContext, NotFoundError, ValidationError } from './errors';
export { CrmNotFoundError, CrmValidationError, CrmConflictError } from './errors';

// Which workflows hold a price OFFER rather than a BILL, and what each is
// called. Defined once in @wizeworks/crm-schemas and re-exported here so a
// package that already depends on the CRM (the automation resolvers, say) can
// read the rule without keeping its own copy of the slug. `check:price-offers`
// fails on any second copy — see the note there, and issue 764.
export {
  B2B_QUOTE_WORKFLOW_SLUG,
  CUSTOMER_ESTIMATE_WORKFLOW_SLUG,
  isPriceOfferWorkflow,
  billingDocumentNoun,
  NOT_OWED_STAGE_TYPES,
  PRICE_OFFER_WORKFLOW_SLUGS,
  isOwedDocument,
} from '@wizeworks/crm-schemas/builtins';

// What two businesses can agree to pay on ("prepay", "net14", "net45"). One
// shape for every write, re-exported so the wholesale account's own save path
// reads it rather than keeping the old five-value list (sparx persona issue 076).
export { PaymentTerms } from '@wizeworks/crm-schemas';
// When a wholesale account still needs its prices and terms set up: the condition
// on the set-up task's automation, and the test that closes that task. One rule,
// re-exported so the automation seed and resolver read it rather than a copy.
export {
  ACCOUNT_SET_UP_TO_DO,
  accountNeedsSetUp,
  accountSetUpFields,
} from '@wizeworks/crm-schemas';
// The buyer's PO number on an order or a document, for packages that read a
// held order without depending on the schemas package themselves.
export { poNumberOf } from '@wizeworks/crm-schemas';

// The same rule as a QUERY: what counts as money somebody owes. Eight reads
// across four packages each spelled their own version and every one of them was
// the payment status alone, so a quote was a receivable (issue 857).
export { ISSUED_BILL_WHERE, OWED_DOCUMENT_WHERE } from './services/billing-document-service';

// The order-side twin of the rule above, and for the same reason: "is money
// still owed" was asked as a payment column value, so a cancelled order counted
// and a part-paid one did not (issue 859).
export { OWING_ORDER_WHERE } from './services/order-service';
