// Authoring catalog for the Automations builder — the human-facing vocabulary
// of triggers, condition operators, and actions, plus the module-derivation used
// by the list/detail chrome. Client-safe (no server imports).
//
// Two honesty rules bake into this catalog:
//   1. The builder only OFFERS actions that have a registered executor
//      (`available: true`) and whose owning module the tenant has active —
//      mirroring docs/81 §6/§8 ("only offer triggers/actions from enabled
//      modules"). Deferred actions (commerce.*, b2b quote/terms, email
//      sequences — no executor yet, docs/84 Slice F1) are defined so an existing
//      rule that references one still renders + round-trips, but they are never
//      offered for a NEW action.
//   2. Event types + condition fields are FREE TEXT (the schema types them as
//      `string`), so the catalog supplies curated SUGGESTIONS, never a hard enum.
//      A tenant can always type a custom event/field.

import type { ActionType, ConditionOperator } from '@sparx/automation-schemas';

export type ModuleSlug = 'crm' | 'email' | 'commerce' | 'b2b' | 'platform' | 'cms';

const MODULE_LABEL: Record<string, string> = {
  crm: 'CRM',
  email: 'Email',
  commerce: 'Commerce',
  b2b: 'B2B',
  platform: 'Platform',
  cms: 'CMS',
  ai: 'AI',
};

export function moduleLabel(slug: string): string {
  return MODULE_LABEL[slug] ?? `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
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

/** Curated event suggestions, grouped by owning module. Free text is allowed —
 *  the builder offers these via a datalist, it does not constrain to them. */
export const TRIGGER_EVENTS: readonly TriggerEventDef[] = [
  { eventType: 'crm.customer.created', label: 'Customer created', module: 'crm' },
  { eventType: 'crm.customer.updated', label: 'Customer updated', module: 'crm' },
  { eventType: 'crm.deal.stage_changed', label: 'Deal stage changed', module: 'crm' },
  { eventType: 'crm.deal.won', label: 'Deal won', module: 'crm' },
  { eventType: 'crm.deal.lost', label: 'Deal lost', module: 'crm' },
  { eventType: 'crm.task.created', label: 'Task created', module: 'crm' },
  { eventType: 'order.placed', label: 'Order placed', module: 'commerce' },
  { eventType: 'order.fulfilled', label: 'Order fulfilled', module: 'commerce' },
  { eventType: 'order.cancelled', label: 'Order cancelled', module: 'commerce' },
  { eventType: 'commerce.order.refunded', label: 'Order refunded', module: 'commerce' },
  { eventType: 'b2b.invoice.overdue', label: 'Invoice overdue', module: 'b2b' },
  { eventType: 'b2b.account.credit_hold', label: 'Account on credit hold', module: 'b2b' },
  { eventType: 'b2b.quote.approved', label: 'Quote approved', module: 'b2b' },
  { eventType: 'email.opened', label: 'Email opened', module: 'email' },
  { eventType: 'email.clicked', label: 'Email link clicked', module: 'email' },
  { eventType: 'email.bounced', label: 'Email bounced', module: 'email' },
  { eventType: 'webhook.received', label: 'Inbound webhook received', module: 'platform' },
];

/** Scheduled-trigger scan entities — the registered schedule scanners
 *  (docs/84 Slice C `customer`, Slice F2 `b2b_account`). */
export interface ScanEntityDef {
  entity: string;
  label: string;
  module: ModuleSlug;
}

export const SCAN_ENTITIES: readonly ScanEntityDef[] = [
  { entity: 'customer', label: 'Customers', module: 'crm' },
  { entity: 'b2b_account', label: 'B2B accounts', module: 'b2b' },
];

export function moduleForScanEntity(entity: string): ModuleSlug {
  return SCAN_ENTITIES.find((e) => e.entity === entity)?.module ?? 'platform';
}

export const SCHEDULE_CADENCES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'Once' },
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

/** Map an event type to its owning module by prefix (best-effort, for chrome). */
export function moduleForEventType(eventType: string): ModuleSlug {
  const head = eventType.split('.')[0] ?? '';
  if (head === 'order') return 'commerce';
  if (head === 'crm' || head === 'customer' || head === 'deal') return 'crm';
  if (head === 'commerce') return 'commerce';
  if (head === 'b2b') return 'b2b';
  if (head === 'email') return 'email';
  if (head === 'cms' || head === 'site') return 'cms';
  return 'platform';
}

// ─── conditions ──────────────────────────────────────────────────────────────

export interface ConditionOperatorDef {
  value: ConditionOperator;
  label: string;
  /** Operators that take no right-hand value (presence checks). */
  valueless?: boolean;
  /** Operators whose value is a list. */
  list?: boolean;
}

export const CONDITION_OPERATORS: readonly ConditionOperatorDef[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'gt', label: 'is greater than' },
  { value: 'lt', label: 'is less than' },
  { value: 'gte', label: 'is at least' },
  { value: 'lte', label: 'is at most' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'in', label: 'is any of', list: true },
  { value: 'not_in', label: 'is none of', list: true },
  { value: 'is_set', label: 'is set', valueless: true },
  { value: 'is_not_set', label: 'is not set', valueless: true },
];

export function operatorDef(op: string): ConditionOperatorDef | undefined {
  return CONDITION_OPERATORS.find((o) => o.value === op);
}

/** Curated condition-field suggestions (resolver-exposed paths). Free text. */
export const COMMON_CONDITION_FIELDS: readonly string[] = [
  'customer.type',
  'customer.email',
  'customer.totalSpent',
  'customer.lifetimeOrders',
  'customer.tags',
  'customer.doNotContact',
  'deal.stage',
  'deal.value',
  'order.total',
  'order.status',
  'order.itemCount',
  'b2bAccount.status',
  'b2bAccount.utilization',
  'b2bAccount.maxDaysPastDue',
  'b2bAccount.hasOverdueInvoices',
];

// ─── actions ─────────────────────────────────────────────────────────────────

export type ConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'tags'
  | 'email'
  | 'select'
  | 'json';

export interface ActionConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly { value: string; label: string }[];
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
   *  offered for a NEW action (docs/84 Slice F1: commerce.* / sequences deferred). */
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
  // ── Control flow (platform) ──
  {
    type: 'platform.wait',
    label: 'Wait (durable delay)',
    module: 'platform',
    description: 'Park the run for a delay, then resume. Survives redeploys.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'delaySeconds',
        label: 'Delay (seconds)',
        type: 'number',
        required: true,
        placeholder: '86400',
        help: 'How long to park the run before the next action.',
      },
    ],
  },
  {
    type: 'platform.stop',
    label: 'Stop',
    module: 'platform',
    description: 'End the automation early and log the reason.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'reason', label: 'Reason', type: 'text', placeholder: 'No longer needed' }],
  },
  {
    type: 'platform.webhook',
    label: 'Send webhook',
    module: 'platform',
    description: 'POST a JSON envelope to an external URL (SSRF-guarded).',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com/hook' },
      { key: 'method', label: 'Method', type: 'select', options: HTTP_METHODS },
      { key: 'headers', label: 'Extra headers', type: 'json', help: 'JSON object of header name → value.' },
      { key: 'payload', label: 'Payload', type: 'json', help: 'Arbitrary JSON sent under `payload`.' },
    ],
  },
  // ── CRM ──
  {
    type: 'crm.add_tag',
    label: 'Add tag(s)',
    module: 'crm',
    description: 'Add one or more tags to the triggering customer.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'tags', label: 'Tags', type: 'tags', required: true }],
  },
  {
    type: 'crm.remove_tag',
    label: 'Remove tag(s)',
    module: 'crm',
    description: 'Remove one or more tags from the triggering customer.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'tags', label: 'Tags', type: 'tags', required: true }],
  },
  {
    type: 'crm.add_note',
    label: 'Add note',
    module: 'crm',
    description: 'Record a note on the triggering customer.',
    mode: 'fields',
    available: true,
    configFields: [{ key: 'note', label: 'Note', type: 'textarea', required: true }],
  },
  {
    type: 'crm.update_field',
    label: 'Update customer field',
    module: 'crm',
    description: 'Set a single field on the triggering customer.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'field', label: 'Field', type: 'text', required: true, placeholder: 'type' },
      { key: 'value', label: 'Value', type: 'json', required: true, help: 'Validated by the customer service.' },
    ],
  },
  {
    type: 'crm.create_task',
    label: 'Create task',
    module: 'crm',
    description: 'Open a CRM task, anchored to the triggering customer/deal.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'dueInDays', label: 'Due in (days)', type: 'number', placeholder: '3' },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
      {
        key: 'assignedToUserId',
        label: 'Assign to (user ID)',
        type: 'text',
        required: true,
        help: 'A staff user UUID — also recorded as the task creator.',
      },
    ],
  },
  {
    type: 'crm.update_deal_stage',
    label: 'Move deal stage',
    module: 'crm',
    description: 'Move the triggering deal to a pipeline stage.',
    mode: 'fields',
    available: true,
    configFields: [
      {
        key: 'toStageId',
        label: 'To stage (stage ID)',
        type: 'text',
        required: true,
        help: 'A pipeline stage UUID.',
      },
    ],
  },
  // ── Email ──
  {
    type: 'email.send_campaign',
    label: 'Send marketing email',
    module: 'email',
    description: 'Enqueue a customer-addressed send (Builder email or coded template).',
    mode: 'json',
    available: true,
    jsonTemplate: { builderEmailId: '', subject: '' },
  },
  {
    type: 'email.send_internal',
    label: 'Send staff notification',
    module: 'email',
    description: 'Email a configured staff address (transactional).',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'to', label: 'To', type: 'email', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'text', label: 'Text body', type: 'textarea', help: 'Provide a text and/or HTML body.' },
      { key: 'html', label: 'HTML body', type: 'textarea' },
    ],
  },
  {
    type: 'email.sequence_add',
    label: 'Add to email sequence',
    module: 'email',
    description: 'Deferred — no email-sequence subsystem yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  {
    type: 'email.sequence_remove',
    label: 'Remove from email sequence',
    module: 'email',
    description: 'Deferred — no email-sequence subsystem yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  // ── B2B ──
  {
    type: 'b2b.escalate_overdue',
    label: 'Escalate overdue account',
    module: 'b2b',
    description: 'Run the dunning ladder on the triggering B2B account.',
    mode: 'fields',
    available: true,
    configFields: [
      { key: 'creditHoldDays', label: 'Credit-hold after (days)', type: 'number', placeholder: '14' },
      { key: 'suspendDays', label: 'Suspend after (days)', type: 'number', placeholder: '30' },
    ],
  },
  {
    type: 'b2b.create_quote',
    label: 'Create quote',
    module: 'b2b',
    description: 'Deferred — no executor yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  {
    type: 'b2b.convert_quote',
    label: 'Convert quote',
    module: 'b2b',
    description: 'Deferred — no executor yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  {
    type: 'b2b.update_terms',
    label: 'Update terms',
    module: 'b2b',
    description: 'Deferred — no executor yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  // ── Commerce (all deferred — no executors yet, docs/84 Slice F1) ──
  {
    type: 'commerce.create_invoice',
    label: 'Create invoice',
    module: 'commerce',
    description: 'Deferred — no executor yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.apply_discount',
    label: 'Apply discount',
    module: 'commerce',
    description: 'Deferred — no executor yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.update_inventory',
    label: 'Update inventory',
    module: 'commerce',
    description: 'Deferred — no executor yet (docs/84 Slice F1).',
    mode: 'json',
    available: false,
  },
  {
    type: 'commerce.create_order',
    label: 'Create order',
    module: 'commerce',
    description: 'Deferred — no executor yet (docs/84 Slice F1).',
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
  return (type.split('.')[0] as ModuleSlug) ?? 'platform';
}

/** Actions offerable for a NEW step: registered executor + owning module active
 *  (platform actions are always offered). */
export function availableActions(enabledModules: readonly string[]): ActionDef[] {
  const active = new Set(enabledModules);
  return ACTION_DEFS.filter(
    (a) => a.available && (a.module === 'platform' || active.has(a.module))
  );
}

// ─── module derivation for list/detail chrome ────────────────────────────────

interface ParsedTriggerLite {
  triggerType: string;
  triggerConfig: unknown;
}

interface ParsedActionLite {
  type: string;
}

/** The distinct feature modules an automation touches (drops `platform` — wait/
 *  stop/webhook don't tag a module). Used for the "CRM + Email" row badges. */
export function deriveModules(
  trigger: ParsedTriggerLite,
  actions: readonly ParsedActionLite[]
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
