// Service-layer barrel. Each service is exposed under a namespace so
// callers write `customerService.list(ctx, ...)`, `dealService.moveStage(...)`,
// etc. — symmetric with how the MCP tool registry will surface them.

export * as customerService from './customer-service';
export * as b2bAccountService from './b2b-account-service';
export * as b2bEscalationService from './b2b-escalation-service';
export * as pipelineService from './pipeline-service';
export * as dealService from './deal-service';
export * as activityService from './activity-service';
export * as taskService from './task-service';
export * as segmentService from './segment-service';

// CRM — orders / quotes spine (Phase 3). Each service file stays under
// the 200-line target by splitting subresources into their own files.
export * as orderService from './order-service';
export * as orderPaymentsService from './order-payments-service';
export * as orderRefundsService from './order-refunds-service';
export * as orderFulfillmentsService from './order-fulfillments-service';
export * as quoteService from './quote-service';
export * as quoteLifecycleService from './quote-lifecycle-service';

// Invoicing module (docs/87) — authored billing documents. Phase 1 exposes the
// workflow / stage / line-type config surface; documents + lines land in later
// phases.
export * as documentWorkflowService from './document-workflow-service';
export * as documentLineTypeService from './document-line-type-service';
export * as billingDocumentService from './billing-document-service';
export * as billingLineService from './billing-line-service';
export * as billingDocumentStageService from './billing-document-stage-service';
export * as billingPaymentService from './billing-payment-service';

// CRM reporting — read-only metrics for the dashboard reports page and
// the MCP get_crm_metrics tool. Live queries today; nightly rollup later.
export * as reportingService from './reporting-service';
