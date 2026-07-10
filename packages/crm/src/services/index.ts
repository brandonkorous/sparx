// Service-layer barrel. Each service is exposed under a namespace so
// callers write `customerService.list(ctx, ...)`, `dealService.moveStage(...)`,
// etc. — symmetric with how the MCP tool registry will surface them.

export * as customerService from './customer-service';
export * as b2bAccountService from './b2b-account-service';
export * as b2bEscalationService from './b2b-escalation-service';
// Order-derived B2B net-terms AR, materialised as BillingDocuments (docs/87 §15).
export * as b2bArService from './b2b-ar-service';
// Quotes are BillingDocuments on the system `b2b-quotes` workflow.
export * as b2bQuoteService from './b2b-quote-service';
// The direct-customer (non-B2B) counterpart — estimate requests on the system
// `customer-estimates` workflow.
export * as customerEstimateService from './customer-estimate-service';
export * as pipelineService from './pipeline-service';
export * as dealService from './deal-service';
export * as activityService from './activity-service';
export * as taskService from './task-service';
// Site-form lead capture (docs/115) — shared by the automation crm.capture_lead
// action and the CRM-activation backfill.
export * as leadService from './lead-service';
export * as segmentService from './segment-service';

// CRM — orders spine (Phase 3). Each service file stays under the 200-line
// target by splitting subresources into their own files.
export * as orderService from './order-service';
export * as orderPaymentsService from './order-payments-service';
export * as orderRefundsService from './order-refunds-service';
export * as orderFulfillmentsService from './order-fulfillments-service';

// Invoicing module (docs/87) — authored billing documents. This is now the
// ONE quote/estimate/invoice/receipt entity — the old standalone Quote model
// (quote-service.ts / quote-lifecycle-service.ts) converged onto it; see
// billing-document-conversion-service.ts for the quote→order conversion it
// inherited.
export * as documentWorkflowService from './document-workflow-service';
export * as documentLineTypeService from './document-line-type-service';
export * as billingDocumentService from './billing-document-service';
export * as billingLineService from './billing-line-service';
export * as billingDocumentStageService from './billing-document-stage-service';
export * as billingDocumentConversionService from './billing-document-conversion-service';
export * as billingPaymentService from './billing-payment-service';
export * as billingRenderService from './billing-render-service';
export * as billingTemplateService from './billing-template-service';
export type { BillingTemplateDto } from './billing-template-service';
// The default renderer + the shared print section builders the builder-authored
// template renderer (api-rest's renderInvoiceTree) composes (docs/87 §10).
export {
  renderBillingDocumentHtml,
  resolveBillingBrand,
  invoiceStyles,
  invoiceHtmlShell,
  sellerBlockHtml,
  docHeadBlockHtml,
  partiesBlockHtml,
  lineTableHtml,
  totalsBlockHtml,
  notesBlockHtml,
  paymentsBlockHtml,
  escapeHtml,
  formatMoney,
  formatDate,
  type BillingRenderBrand,
  type BillingRenderData,
  type BillingRenderParty,
  type BillingRenderLine,
  type BillingRenderTotals,
} from './billing-document-html';

// CRM reporting — read-only metrics for the dashboard reports page and
// the MCP get_crm_metrics tool. Live queries today; nightly rollup later.
export * as reportingService from './reporting-service';

// Invoicing reporting (docs/87 §8, docs/97 §5) — collected/billed timeseries
// from the `rollup_invoicing_daily_collected` rollup, with the same nightly
// reconcile + read-endpoint live-overlay pattern as commerce's revenue rollup.
export * as invoicingReportingService from './invoicing-reporting-service';
