// Built-in CRM templates. Each tenant gets their own editable copy on CRM
// activation (decision: same pattern as the default pipeline template,
// rather than the cms-schemas content-type pattern of "one row per
// platform tenant" — tenants need to be able to rename and reweight
// these without affecting other tenants).

export { DEFAULT_PIPELINE_TEMPLATE } from './pipeline';
export type { PipelineTemplate, PipelineStageTemplate } from './pipeline';
export {
  DEFAULT_TICKET_PIPELINE_TEMPLATE,
  DEFAULT_SLA_POLICY_TEMPLATE,
  TICKET_PIPELINE_SLUG,
} from './tickets';
export type { SlaPolicyTemplate, SlaTargetTemplate } from './tickets';
export { BUILT_IN_SEGMENT_TEMPLATES, NEWSLETTER_SEGMENT_SLUG } from './segments';
export type { SegmentTemplate } from './segments';
export {
  DEFAULT_DOCUMENT_WORKFLOWS,
  DEFAULT_DOCUMENT_LINE_TYPES,
  DEFAULT_INVOICE_TEMPLATE,
  INVOICE_STRUCTURED_NODE_TYPES,
  NET_TERMS_AR_WORKFLOW,
  NET_TERMS_AR_WORKFLOW_SLUG,
  B2B_QUOTE_WORKFLOW,
  B2B_QUOTE_WORKFLOW_SLUG,
  CUSTOMER_ESTIMATE_WORKFLOW,
  CUSTOMER_ESTIMATE_WORKFLOW_SLUG,
  // The one place that decides whether a workflow holds a price OFFER or a
  // BILL, and what each is called. Read by the print renderer and by both
  // consoles, so the page a customer receives and the screen it was typed on
  // cannot disagree about what the document is.
  isPriceOfferWorkflow,
  billingDocumentNoun,
  // The slugs the platform itself resolves by, and so the ones a tenant cannot
  // rename. The service refuses the change; the console explains why.
  SYSTEM_WORKFLOW_SLUGS,
  isSystemWorkflowSlug,
  // Is this money somebody owes? The AR question, asked once, so the figure on
  // the console and the page the customer receives cannot disagree (issue 857).
  NOT_OWED_STAGE_TYPES,
  PRICE_OFFER_WORKFLOW_SLUGS,
  isOwedDocument,
} from './invoicing';
export type {
  DocumentWorkflowTemplate,
  DocumentStageTemplate,
  DocumentLineTypeTemplate,
  DocumentStageTypeLiteral,
  LinePricingModeLiteral,
  DocumentTemplateSeed,
} from './invoicing';
