// The authoring vocabulary for the automations builder — the human-facing set of
// triggers, condition operators, and actions the editor offers, written for a
// business owner rather than a developer.
//
// Two honesty rules bake in, straight from the engine's own contract:
//   1. Event types and condition fields are FREE TEXT in the schema (typed as
//      `string`), so this file supplies curated SUGGESTIONS, never a hard enum —
//      a rule can always reference a custom event or field, and an existing one
//      that does still round-trips.
//   2. Only actions with a registered executor are OFFERED for a new step
//      (`available: true`). Deferred actions are still defined so an existing
//      rule that uses one renders and saves unchanged, but they are never a
//      choice when building something new.
//
// Pure and client-safe: no server imports, no hooks. Built from scratch for the
// workbench; it does not depend on the dashboard's copy.

import type { ActionType, ConditionOperator } from '@sparx/automation-schemas';

/** The feature modules an automation can touch — the keys used for the module
 *  tags on a rule row. Matches the workbench module hues. */
export type ModuleSlug =
  | 'crm'
  | 'email'
  | 'commerce'
  | 'b2b'
  | 'cms'
  | 'invoicing'
  | 'social'
  | 'platform';

const MODULE_LABEL: Record<ModuleSlug, string> = {
  crm: 'Customers',
  email: 'Email',
  commerce: 'Selling',
  b2b: 'Wholesale',
  cms: 'Content',
  invoicing: 'Invoicing',
  social: 'Social posts',
  platform: 'Platform',
};

export function moduleLabel(slug: ModuleSlug): string {
  return MODULE_LABEL[slug] ?? slug;
}

/** Render an unknown config/condition value as display text without tripping
 *  `no-base-to-string`: primitives stringify, objects/arrays serialize as JSON. */
export function primitiveText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

// ─── triggers ────────────────────────────────────────────────────────────────

export interface TriggerEventDef {
  eventType: string;
  label: string;
  module: ModuleSlug;
}

/** Curated event suggestions, grouped by the part of the business they come
 *  from. Free text is still allowed — these are offered, not enforced.
 *
 *  Every entry here corresponds to an event the automation ENGINE actually
 *  publishes and (where fields matter) has a registered resolver for, so the
 *  suggestions never dangle a trigger that can't fire or resolves nothing. */
export const TRIGGER_EVENTS: readonly TriggerEventDef[] = [
  // ── Selling — orders ──
  { eventType: 'order.placed', label: 'An order is placed', module: 'commerce' },
  { eventType: 'order.paid', label: 'An order is paid', module: 'commerce' },
  { eventType: 'order.fulfilled', label: 'An order is fulfilled', module: 'commerce' },
  { eventType: 'order.delivered', label: 'An order is delivered', module: 'commerce' },
  { eventType: 'order.cancelled', label: 'An order is cancelled', module: 'commerce' },
  { eventType: 'order.refunded', label: 'An order is refunded', module: 'commerce' },
  { eventType: 'order.payment_failed', label: 'An order payment fails', module: 'commerce' },
  // ── Selling — subscriptions ──
  { eventType: 'subscription.created', label: 'A subscription starts', module: 'commerce' },
  { eventType: 'subscription.renewed', label: 'A subscription renews', module: 'commerce' },
  {
    eventType: 'subscription.payment_failed',
    label: 'A subscription payment fails',
    module: 'commerce',
  },
  { eventType: 'subscription.paused', label: 'A subscription is paused', module: 'commerce' },
  { eventType: 'subscription.resumed', label: 'A subscription resumes', module: 'commerce' },
  { eventType: 'subscription.cancelled', label: 'A subscription is cancelled', module: 'commerce' },
  // ── Selling — returns ──
  { eventType: 'return.approved', label: 'A return is approved', module: 'commerce' },
  { eventType: 'return.received', label: 'A return is received', module: 'commerce' },
  { eventType: 'return.refunded', label: 'A return is refunded', module: 'commerce' },
  // ── Selling — inventory ──
  { eventType: 'inventory.low', label: 'A product runs low on stock', module: 'commerce' },
  { eventType: 'inventory.depleted', label: 'A product sells out', module: 'commerce' },
  // ── Content ──
  { eventType: 'product.published', label: 'A product goes live', module: 'cms' },
  {
    eventType: 'content.entry.published',
    label: 'An article or page is published',
    module: 'cms',
  },
  { eventType: 'form.submitted', label: 'A form on your site is submitted', module: 'cms' },
  // ── Customers (CRM) ──
  { eventType: 'crm.customer.created', label: 'A new customer is added', module: 'crm' },
  { eventType: 'crm.customer.updated', label: 'A customer’s details change', module: 'crm' },
  { eventType: 'crm.customer.subscribed', label: 'A customer opts in to marketing', module: 'crm' },
  { eventType: 'crm.deal.created', label: 'A sales deal is created', module: 'crm' },
  {
    eventType: 'crm.deal.stage_changed',
    label: 'A sales deal changes stage (e.g. won or lost)',
    module: 'crm',
  },
  { eventType: 'crm.task.created', label: 'A task is created', module: 'crm' },
  // ── Invoicing ──
  {
    eventType: 'crm.billing_document.created',
    label: 'A quote, estimate or invoice is created',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.finalized',
    label: 'An invoice is finalised',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.paid',
    label: 'An invoice is paid in full',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.converted',
    label: 'A quote is converted to an order',
    module: 'invoicing',
  },
  {
    eventType: 'crm.billing_document.stage_changed',
    label: 'A quote or invoice changes stage',
    module: 'invoicing',
  },
  // ── Wholesale (B2B) ──
  { eventType: 'crm.b2b_account.created', label: 'A wholesale account is created', module: 'b2b' },
  { eventType: 'b2b.order.approved', label: 'A wholesale order is approved', module: 'b2b' },
  { eventType: 'b2b.order.rejected', label: 'A wholesale order is rejected', module: 'b2b' },
  { eventType: 'b2b.invoice.overdue', label: 'A wholesale invoice is overdue', module: 'b2b' },
  {
    eventType: 'b2b.account.credit_hold',
    label: 'A wholesale account goes on credit hold',
    module: 'b2b',
  },
  // ── Email ──
  { eventType: 'email.opened', label: 'A marketing email is opened', module: 'email' },
  { eventType: 'email.clicked', label: 'A link in an email is clicked', module: 'email' },
  { eventType: 'email.bounced', label: 'A marketing email bounces', module: 'email' },
];

/** A scheduled trigger scans a kind of record on a timer; these are the kinds it
 *  can scan (the registered schedule scanners). */
export interface ScanEntityDef {
  entity: string;
  label: string;
  module: ModuleSlug;
}

export const SCAN_ENTITIES: readonly ScanEntityDef[] = [
  { entity: 'customer', label: 'Customers', module: 'crm' },
  { entity: 'b2b_account', label: 'Wholesale accounts', module: 'b2b' },
  { entity: 'billing_document', label: 'Quotes & invoices', module: 'invoicing' },
  { entity: 'cart', label: 'Abandoned carts', module: 'commerce' },
  // A quote IS a billing document (the b2b-quotes workflow), so it shares the
  // invoicing hue with billing_document above.
  { entity: 'quote', label: 'Quotes awaiting a decision', module: 'invoicing' },
  // No 'chat' module hue exists (the ModuleSlug union has no 'chat'), and chat
  // lives under Customers — so conversations wear the CRM hue.
  { entity: 'conversation', label: 'Chat conversations', module: 'crm' },
];

export function scanEntityLabel(entity: string): string {
  return SCAN_ENTITIES.find((e) => e.entity === entity)?.label ?? entity;
}

export function moduleForScanEntity(entity: string): ModuleSlug {
  return SCAN_ENTITIES.find((e) => e.entity === entity)?.module ?? 'platform';
}

export const SCHEDULE_CADENCES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'interval', label: 'Every so many minutes' },
  { value: 'once', label: 'Once, at a set time' },
] as const;

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

/** Map an event type to the part of the business it belongs to (best-effort, for
 *  the module tags on a row). */
export function moduleForEventType(eventType: string): ModuleSlug {
  if (eventType.startsWith('crm.billing_document.')) return 'invoicing';
  const head = eventType.split('.')[0] ?? '';
  if (
    head === 'order' ||
    head === 'product' ||
    head === 'variant' ||
    head === 'inventory' ||
    head === 'return' ||
    head === 'subscription' ||
    head === 'payment'
  ) {
    return 'commerce';
  }
  if (head === 'crm' || head === 'customer' || head === 'deal') return 'crm';
  if (head === 'commerce') return 'commerce';
  if (head === 'b2b') return 'b2b';
  if (head === 'email') return 'email';
  if (head === 'cms' || head === 'content' || head === 'site' || head === 'form') return 'cms';
  if (head === 'social') return 'social';
  return 'platform';
}

// ─── conditions ──────────────────────────────────────────────────────────────

export interface ConditionOperatorDef {
  value: ConditionOperator;
  label: string;
  /** Takes no right-hand value (a presence check). */
  valueless?: boolean;
  /** The value is a comma-separated list. */
  list?: boolean;
}

export const CONDITION_OPERATORS: readonly ConditionOperatorDef[] = [
  { value: 'eq', label: 'is exactly' },
  { value: 'neq', label: 'is not' },
  { value: 'gt', label: 'is more than' },
  { value: 'lt', label: 'is less than' },
  { value: 'gte', label: 'is at least' },
  { value: 'lte', label: 'is at most' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'in', label: 'is one of', list: true },
  { value: 'not_in', label: 'is none of', list: true },
  { value: 'is_set', label: 'has any value', valueless: true },
  { value: 'is_not_set', label: 'is empty', valueless: true },
];

export function operatorDef(op: string): ConditionOperatorDef | undefined {
  return CONDITION_OPERATORS.find((o) => o.value === op);
}

/** Curated condition-field suggestions (resolver-exposed paths). Free text. */
export const COMMON_CONDITION_FIELDS: readonly string[] = [
  'customer.type',
  'customer.lifecycleStage',
  'customer.leadStatus',
  'customer.email',
  'customer.totalSpent',
  'customer.lifetimeOrders',
  'customer.tags',
  'deal.stage',
  'deal.value',
  'order.total',
  'order.status',
  'order.itemCount',
  'b2bAccount.status',
  'b2bAccount.hasOverdueInvoices',
  'form.formName',
  'form.pageSlug',
];

// ─── actions ─────────────────────────────────────────────────────────────────

export type ConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'tags'
  | 'email'
  | 'select'
  | 'json'
  /**
   * Pick several from a list the SERVER knows and this file cannot — a tenant's own
   * connected social accounts, for instance. `options` is static config; this is the
   * escape hatch for a choice whose values only exist at runtime, named by
   * {@link ActionConfigField.optionSource}.
   */
  | 'multiselect';

/** Where a `select`/`multiselect` gets its choices. One name per live-data list, so
 *  the form stays declarative and the fetching stays in one place. */
export type ConfigOptionSource = 'social-targets' | 'email-sequences';

export interface ActionConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly { value: string; label: string }[];
  /** For a `multiselect` (pick several) or a `select` (pick one) — which live
   *  list to offer, when the choices only exist at runtime. */
  optionSource?: ConfigOptionSource;
  /** Shown in place of the list when the source has nothing to offer yet. */
  emptyHint?: string;
}

export interface ActionDef {
  type: ActionType;
  label: string;
  module: ModuleSlug;
  description: string;
  /** 'fields' → typed config form; 'json' → raw JSON (union/ID configs the UI
   *  can't safely pick); 'none' → no config. */
  mode: 'fields' | 'json' | 'none';
  /** Whether a runtime executor is registered — only available actions are
   *  offered for a NEW step. */
  available: boolean;
  configFields?: readonly ActionConfigField[];
  /** Seed shown in the JSON editor for a fresh 'json'-mode action. */
  jsonTemplate?: Record<string, unknown>;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

const HTTP_METHODS = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
] as const;

export const ACTION_DEFS: readonly ActionDef[] = [
  // ── Control flow ──
  {
    type: 'platform.wait',
    label: 'Wait a while',
    module: 'platform',
    description: 'Pause before the next step — for example, wait a day before following up.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'delaySeconds',
        label: 'Wait for (seconds)',
        type: 'number',
        required: true,
        placeholder: '86400',
        help: 'How long to pause. 3600 is an hour, 86400 is a day.',
      },
    ],
  },
  {
    type: 'platform.stop',
    label: 'Stop here',
    module: 'platform',
    description: 'End the automation early and note why.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'reason', label: 'Reason', type: 'text', placeholder: 'No longer needed' },
    ],
  },
  {
    type: 'platform.webhook',
    label: 'Send data to another system',
    module: 'platform',
    description: 'POST the details to an outside web address (a webhook).',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'url',
        label: 'Web address',
        type: 'text',
        required: true,
        placeholder: 'https://example.com/hook',
      },
      { key: 'method', label: 'Method', type: 'select', options: HTTP_METHODS },
      {
        key: 'headers',
        label: 'Extra headers',
        type: 'json',
        help: 'Advanced — a set of header name → value pairs, as JSON.',
      },
      {
        key: 'payload',
        label: 'Extra data',
        type: 'json',
        help: 'Advanced — any extra data to include, as JSON.',
      },
    ],
  },
  {
    type: 'platform.notify',
    label: 'Notify the team in-app',
    module: 'platform',
    description: 'Post a notification your team sees inside the workbench.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'title', label: 'Heading', type: 'text', required: true },
      { key: 'body', label: 'Message', type: 'textarea' },
    ],
  },
  // ── Customers (CRM) ──
  {
    type: 'crm.add_tag',
    label: 'Add a label to the customer',
    module: 'crm',
    description: 'Tag the customer this rule is about with one or more labels.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'tags', label: 'Labels', type: 'tags', required: true, placeholder: 'vip, repeat' },
    ],
  },
  {
    type: 'crm.remove_tag',
    label: 'Remove a label from the customer',
    module: 'crm',
    description: 'Take one or more labels off the customer this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'tags', label: 'Labels', type: 'tags', required: true }],
  },
  {
    type: 'crm.add_note',
    label: 'Add a note to the customer',
    module: 'crm',
    description: 'Record a note on the customer this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'note', label: 'Note', type: 'textarea', required: true }],
  },
  {
    type: 'crm.update_field',
    label: 'Change a detail on the customer',
    module: 'crm',
    description: 'Set a single field on the customer this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'field', label: 'Which detail', type: 'text', required: true, placeholder: 'type' },
      {
        key: 'value',
        label: 'New value',
        type: 'json',
        required: true,
        help: 'The value to set, as JSON (e.g. "wholesale" or 5).',
      },
    ],
  },
  {
    type: 'crm.create_task',
    label: 'Create a task',
    module: 'crm',
    description: 'Open a follow-up task, linked to the customer or deal this rule is about.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'description', label: 'Details', type: 'textarea' },
      { key: 'dueInDays', label: 'Due in (days)', type: 'number', placeholder: '3' },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
      {
        key: 'assignedToUserId',
        label: 'Assign to (team member ID)',
        type: 'text',
        required: true,
        help: 'The ID of the team member who owns this task.',
      },
    ],
  },
  {
    type: 'crm.update_deal_stage',
    label: 'Move the sales deal',
    module: 'crm',
    description: 'Move the deal this rule is about to a pipeline stage.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'toStageId',
        label: 'To stage (stage ID)',
        type: 'text',
        required: true,
        help: 'The ID of the pipeline stage to move the deal into.',
      },
    ],
  },
  {
    type: 'crm.capture_lead',
    label: 'Save the form contact as a customer',
    module: 'crm',
    description:
      'Save whoever submitted a form as a customer and log their message — and, if the form is set to, open a sales deal. Follows the form’s own settings.',
    mode: 'none',
    available: true,
  },
  // ── Site forms ──
  {
    type: 'form.notify',
    label: 'Email me the form submission',
    module: 'cms',
    description:
      'Email you (and any recipients set on the form) when it is submitted. Follows the form’s “email me” setting.',
    mode: 'none',
    available: true,
  },
  {
    type: 'form.autoreply',
    label: 'Send the visitor a confirmation',
    module: 'cms',
    description:
      'Send the person who submitted the form a confirmation reply. Follows the form’s “send a confirmation” setting.',
    mode: 'none',
    available: true,
  },
  // ── Email ──
  {
    type: 'email.send_campaign',
    label: 'Send a marketing email',
    module: 'email',
    description: 'Send the customer a designed email or coded template.',
    mode: 'json',
    available: true,
    jsonTemplate: { builderEmailId: '', subject: '' },
  },
  {
    type: 'email.send_internal',
    label: 'Email a note to staff',
    module: 'email',
    description: 'Email one of your own team members.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'to', label: 'To', type: 'email', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'text', label: 'Message', type: 'textarea', help: 'A plain-text and/or HTML body.' },
      { key: 'html', label: 'HTML body (optional)', type: 'textarea' },
    ],
  },
  {
    type: 'email.sequence_add',
    label: 'Add to an email sequence',
    module: 'email',
    description:
      'Start the customer on a multi-touch email sequence — a welcome series, a follow-up, a nurture. The sequence sends each email on its own schedule.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'sequenceId',
        label: 'Which sequence',
        type: 'select',
        required: true,
        optionSource: 'email-sequences',
        help: 'Which sequence to start them on.',
        emptyHint: 'No sequences yet — create one under Email → Sequences.',
      },
    ],
  },
  {
    type: 'email.sequence_remove',
    label: 'Remove from an email sequence',
    module: 'email',
    description:
      'Take the customer out of an email sequence, so they stop getting the rest of its emails.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'sequenceId',
        label: 'Which sequence',
        type: 'select',
        required: true,
        optionSource: 'email-sequences',
        help: 'Which sequence to take them out of.',
        emptyHint: 'No sequences yet — create one under Email → Sequences.',
      },
    ],
  },
  // ── Wholesale (B2B) ──
  {
    type: 'b2b.escalate_overdue',
    label: 'Chase an overdue wholesale account',
    module: 'b2b',
    description: 'Run the overdue-account ladder (credit hold, then suspend) on the account.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'creditHoldDays',
        label: 'Credit hold after (days)',
        type: 'number',
        placeholder: '14',
      },
      { key: 'suspendDays', label: 'Suspend after (days)', type: 'number', placeholder: '30' },
    ],
  },
  {
    type: 'b2b.create_quote',
    label: 'Create a wholesale quote',
    module: 'b2b',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'b2b.convert_quote',
    label: 'Convert a wholesale quote',
    module: 'b2b',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'b2b.update_terms',
    label: 'Update wholesale terms',
    module: 'b2b',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  // ── Social posts ──
  {
    type: 'social.post',
    label: 'Post to social media',
    module: 'social',
    description:
      'Drafts a post to your connected social accounts. By default it lands in your Approvals inbox to review first; you can also set it to post automatically.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'template',
        label: 'Message',
        type: 'textarea',
        required: true,
        placeholder: 'New arrival — {{announce.title}}',
        help: 'The post text. Use {{announce.title}} for the product or article name; the link and image are attached for you.',
      },
      {
        key: 'targetIds',
        label: 'Which accounts',
        type: 'multiselect',
        optionSource: 'social-targets',
        help: 'Leave everything unticked to post to all your connected accounts. Tick some to narrow this automation to just those.',
        emptyHint:
          'No connected accounts yet — connect one under Social → Connections and they will appear here.',
      },
      {
        key: 'autoApprove',
        label: 'Before it goes out',
        type: 'select',
        options: [
          { value: '', label: 'Send to my Approvals inbox to review first' },
          { value: 'auto', label: 'Post automatically, no review' },
        ],
        help: 'Reviewing first is recommended until you trust the drafts.',
      },
    ],
  },
  // ── Selling (Commerce — deferred) ──
  {
    type: 'commerce.create_invoice',
    label: 'Create an invoice',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.apply_discount',
    label: 'Apply a discount',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.update_inventory',
    label: 'Adjust stock',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.create_order',
    label: 'Create an order',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
  {
    type: 'inventory.draft_reorder_po',
    label: 'Draft a restock order',
    module: 'commerce',
    description: 'Not available yet.',
    mode: 'json',
    available: false,
  },
];

export function actionDef(type: string): ActionDef | undefined {
  return ACTION_DEFS.find((a) => a.type === type);
}

export function actionLabel(type: string): string {
  return actionDef(type)?.label ?? type;
}

export function moduleForActionType(type: string): ModuleSlug {
  const head = type.split('.')[0] ?? '';
  if (head === 'form') return 'cms';
  if (head === 'inventory') return 'commerce';
  const def = actionDef(type);
  if (def) return def.module;
  return (head as ModuleSlug) || 'platform';
}

/** Actions offerable for a NEW step: has an executor, and its module is active
 *  (platform actions are always offered). */
export function availableActions(enabledModules: readonly string[]): ActionDef[] {
  const active = new Set(enabledModules);
  return ACTION_DEFS.filter(
    (a) => a.available && (a.module === 'platform' || active.has(a.module))
  );
}

// ─── module derivation for a rule row ────────────────────────────────────────

interface ParsedTriggerLite {
  triggerType: string;
  triggerConfig: unknown;
}

/** The distinct parts of the business a rule touches (drops 'platform' — a wait
 *  or a webhook doesn't tag a module). Feeds the row's "Customers + Email" tags. */
export function deriveModules(
  trigger: ParsedTriggerLite,
  actions: readonly { type: string }[]
): ModuleSlug[] {
  const set = new Set<ModuleSlug>();
  if (trigger.triggerType.startsWith('schedule.')) {
    const cfg = (trigger.triggerConfig ?? {}) as { predicate?: { entity?: string } };
    if (cfg.predicate?.entity) set.add(moduleForScanEntity(cfg.predicate.entity));
  } else {
    set.add(moduleForEventType(trigger.triggerType));
  }
  for (const a of actions) set.add(moduleForActionType(a.type));
  set.delete('platform');
  return [...set];
}
