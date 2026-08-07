// Service-layer barrel. Each service is exposed under a namespace so
// callers write `customerService.list(ctx, ...)`, `dealService.moveStage(...)`,
// etc. — symmetric with how the MCP tool registry will surface them.

export * as customerService from './customer-service';
export * as b2bAccountService from './b2b-account-service';
export * as b2bAccountContactService from './b2b-account-contact-service';
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

// The object registry (docs/144 §3) — what a CRM record IS, per tenant: the
// four built-ins plus whatever the business invented, and the extra properties
// they track on each. `crmRecordService` holds the rows of a custom object.
export * as objectDefService from './object-def-service';
export * as crmRecordService from './crm-record-service';
// The relationship graph (docs/144 §6) — "these two records are related, and
// here is how", layered over the legacy FK columns rather than replacing them.
export * as associationService from './association-service';
export type { AssociationView } from './association-service';
// The engagement spine (docs/144 §5) — what was SAID, as opposed to what the
// platform did. Sending, receiving, logging a call, writing a note.
export * as engagementService from './engagement-service';
export * as mailboxService from './mailbox-service';
export * as salesTemplateService from './sales-template-service';
export type { ThreadWithMessages, InboundOutcome } from './engagement-service';
export type { MailboxView } from './mailbox-service';
// Calling (docs/144 §5.6) — click-to-call, and the record of what happened.
export * as callService from './call-service';
export * as voiceConnectionService from './voice-connection-service';
export { setCallPlacer, RecordingCallPlacer, describeCall } from './call-service';
export type { CallPlacer, PlaceCallResult, StatusUpdate } from './call-service';
export type { VoiceConnectionView } from './voice-connection-service';
export type { TemplatePerformance } from './sales-template-service';
// Where a 1:1 sales email leaves the building. Injected so @sparx/crm carries no
// transport dependency — api-rest installs the real one at boot.
export {
  setOutboundMailSink,
  htmlToText,
  mintMessageId,
  RecordingMailSink,
  type OutboundMail,
  type OutboundMailSink,
} from './outbound-mail';
export {
  primaryMirrorFor,
  recordExists,
  resolveRecordRefs,
  type RecordRef,
} from './record-locator';
// The one write path for a tenant-declared property bag, shared by contacts,
// companies, deals, tickets and custom records — exported so the ticket service
// (Phase 4) and the import worker validate exactly the way everything else does.
export {
  asBag,
  asPropertySchema,
  changedProperties,
  resolvePropertyBag,
  toJsonInput,
  type PropertyBag,
} from './custom-properties';
// Spreadsheet columns → declared properties, for the import worker (docs/144
// §3.5). Lives beside the write path because it feeds it.
export {
  describeColumnProblems,
  propertiesFromRow,
  type ColumnProblem,
  type PropertyColumnResult,
} from './property-columns';

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
// The unsaved-draft render path (live preview while editing) — computes totals
// with the same function the save path uses, so preview and saved numbers agree.
export { buildRenderDataFromDraft } from './billing-draft-render';
export type { BillingDraftInput, BillingDraftLine } from './billing-draft-render';
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
