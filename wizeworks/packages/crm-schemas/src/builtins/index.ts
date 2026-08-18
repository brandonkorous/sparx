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
} from './invoicing';
export type {
  DocumentWorkflowTemplate,
  DocumentStageTemplate,
  DocumentLineTypeTemplate,
  DocumentStageTypeLiteral,
  LinePricingModeLiteral,
  DocumentTemplateSeed,
} from './invoicing';
