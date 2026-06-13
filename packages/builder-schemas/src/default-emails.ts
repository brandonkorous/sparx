// The 13 default email templates Sparx provisions on email-module activation
// (docs/91). Unlike the single `welcome` STARTER_EMAIL (seeded on first list),
// these are KEYED defaults that back the platform's transactional + marketing
// automations and are per-site overridable (docs/49 Phase 7b). Each is a
// Builder-authored node-tree — tenant-owned and fully editable once provisioned,
// not a coded React Email component.
//
// Authored in the same ergonomic vocabulary as STARTER_PAGES (the `node()`
// helper → `seedNode`), so the persisted nodes carry the canonical
// `{ id, type, class?, props, binding?, children? }` shape. Built ONCE at module
// load; the id counter runs to completion, giving every tree a stable id sequence.
//
// ── Coordination boundary (docs/91 §0) ──────────────────────────────────────
// Brand chrome (wordmark header + legal footer) is supplied by the email renderer;
// the author composes only the BODY tree. Merge tokens are written inline as
// `{{source.field}}` / `{{customer.firstName ?? "there"}}` — the automation
// module's resolver interpolates them (and resolves every `*Url` token to a real
// link) at dispatch; the field vocabulary is the contract in docs/91 §3.
//
// FOUR node types here are DEFINED, RENDERED, and gate-checked by the automation
// module (its Step 2): `line_item_table`, `conditional_block`, `unsubscribe_link`,
// `physical_address`. We only PLACE them. Their `props`/`binding` JSON below is
// PROVISIONAL — authored against the documented purpose so the 13 trees compose
// now; the exact shapes are finalized against the published `invoicing-overdue`
// reference template when it lands. The node `type` strings match the names the
// automation module published.

import { seedNode, type BoxStyle, type LayoutStyle } from './box-to-class';
import type { BuilderNode } from './node';

// Authored + deterministic ids (a `def-` prefix keeps them clear of the editor's
// runtime `makeId` scheme and the `seed-` starter scheme). Unique within a tree;
// the persisted row's PK is a fresh uuid.
let n = 0;
const sid = (t: string): string => `def-${t}-${(n += 1)}`;

function node(
  type: string,
  opts: {
    box?: BoxStyle;
    layout?: LayoutStyle;
    props?: Record<string, unknown>;
    bind?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  return seedNode(sid(type), type, opts);
}

// ── Body composition helpers (existing node palette) ─────────────────────────

/** The email body root — a stacked Section. The branded frame is the renderer's. */
function body(children: BuilderNode[]): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children,
  });
}

const heading = (text: string): BuilderNode => node('Heading', { props: { level: 'h1', text } });
const para = (text: string): BuilderNode => node('Text', { props: { variant: 'body', text } });
const button = (label: string, href: string): BuilderNode =>
  node('Button', { props: { label, href }, box: { align: 'start' } });

// ── New automation-module node types (PROVISIONAL props — see header) ────────

/** A line-item table over a bound collection (`order.items` / `cart.items` /
 *  `quote.items` / `invoice.items`). Columns are fixed by the source vocabulary
 *  (name/description · quantity · unitPrice · lineTotal). */
const lineItems = (bind: string): BuilderNode => node('line_item_table', { bind });

/** A block shown only when `when` resolves truthy (e.g. an optional credit line,
 *  a quote expiry, dunning consequences). Wraps the conditional children. */
const conditional = (when: string, children: BuilderNode[]): BuilderNode =>
  node('conditional_block', { props: { when }, children });

/** One-click unsubscribe link (marketing only). Renders + feeds List-Unsubscribe
 *  at dispatch; required by the compliance gate on every marketing template. */
const unsubscribeLink = (): BuilderNode => node('unsubscribe_link');

/** The tenant's CAN-SPAM physical postal address (renders EmailSettings.physicalAddress). */
const physicalAddress = (): BuilderNode => node('physical_address');

/** The marketing compliance footer — divider, unsubscribe, physical address. The
 *  three marketing templates (win-back, abandoned-cart, post-purchase-review)
 *  carry it so they pass the gate by construction. */
const complianceFooter = (): BuilderNode[] => [
  node('Divider'),
  unsubscribeLink(),
  physicalAddress(),
];

// ── The 13 trees ─────────────────────────────────────────────────────────────

const welcomeCustomer = (): BuilderNode =>
  body([
    heading('Welcome to {{tenant.name}}'),
    para(
      'Hi {{customer.firstName ?? "there"}} — thanks for creating an account. You’re all set: browse the latest, track your orders, and check out faster every time.'
    ),
    button('Start shopping', '{{tenant.storeUrl}}'),
  ]);

const winBack = (): BuilderNode =>
  body([
    heading('It’s been a while'),
    para(
      'We haven’t seen you at {{tenant.name}} in a bit, {{customer.firstName ?? "there"}}. There’s plenty new since your last visit — come take a look.'
    ),
    button('See what’s new', '{{tenant.storeUrl}}'),
    ...complianceFooter(),
  ]);

const abandonedCart = (): BuilderNode =>
  body([
    heading('Still thinking it over?'),
    para('Your cart is saved and ready whenever you are. Here’s what you left at {{tenant.name}}:'),
    lineItems('cart.items'),
    para('Total: {{cart.total}}'),
    button('Complete your order', '{{cart.recoveryUrl}}'),
    ...complianceFooter(),
  ]);

const postPurchaseReview = (): BuilderNode =>
  body([
    heading('How was your order?'),
    para(
      'Thanks for shopping with {{tenant.name}}, {{customer.firstName ?? "there"}}. We’d love to hear what you thought of order {{order.number}}:'
    ),
    lineItems('order.items'),
    button('Leave a review', '{{order.reviewUrl}}'),
    ...complianceFooter(),
  ]);

const b2bAccountApproved = (): BuilderNode =>
  body([
    heading('You’re approved'),
    para(
      'Good news — {{b2bAccount.companyName}} has been approved for a wholesale account with {{tenant.name}}. You can sign in and order at your account pricing now.'
    ),
    conditional('b2bAccount.creditLimit', [
      para('Your credit line is {{b2bAccount.creditLimit}} on {{b2bAccount.paymentTerms}} terms.'),
    ]),
    button('Go to your portal', '{{b2bAccount.portalUrl}}'),
  ]);

const b2bQuoteReceived = (): BuilderNode =>
  body([
    heading('Your quote is ready'),
    para('Here are the details for quote {{quote.number}}:'),
    lineItems('quote.items'),
    para('Total: {{quote.total}}'),
    conditional('quote.validUntil', [para('Valid until {{quote.validUntil}}.')]),
    button('Review & approve', '{{quote.reviewUrl}}'),
  ]);

const b2bInvoiceDue = (): BuilderNode =>
  body([
    heading('Invoice {{invoice.number}}'),
    para('A reminder that invoice {{invoice.number}} is due in {{invoice.daysUntilDue}} days.'),
    para('Amount due: {{invoice.balance}} · Due {{invoice.dueDate}}'),
    button('Pay now', '{{invoice.payUrl}}'),
  ]);

const b2bQuoteExpiring = (): BuilderNode =>
  body([
    heading('Your quote expires soon'),
    para(
      'Heads-up — quote {{quote.number}} expires on {{quote.validUntil}}. Approve it before then to lock in your pricing.'
    ),
    para('Total: {{quote.total}} · Expires {{quote.validUntil}}'),
    button('Approve now', '{{quote.reviewUrl}}'),
  ]);

const invoicingReminder = (): BuilderNode =>
  body([
    heading('A quick reminder'),
    para(
      'Just a friendly reminder that invoice {{invoice.number}} is due on {{invoice.dueDate}}. Here’s a summary:'
    ),
    lineItems('invoice.items'),
    para('Balance due: {{invoice.balance}} · Due {{invoice.dueDate}}'),
    button('Pay invoice', '{{invoice.payUrl}}'),
  ]);

const invoicingOverdue = (): BuilderNode =>
  body([
    heading('Your invoice is past due'),
    para(
      'Invoice {{invoice.number}} was due on {{invoice.dueDate}} and is now {{invoice.overdueDays}} days overdue. Please submit payment at your earliest convenience.'
    ),
    para('Amount due: {{invoice.balance}} · {{invoice.overdueDays}} days overdue'),
    button('Pay now', '{{invoice.payUrl}}'),
  ]);

const invoicingOverdue2 = (): BuilderNode =>
  body([
    heading('Second notice'),
    para(
      'Our records show invoice {{invoice.number}} remains unpaid and is now {{invoice.overdueDays}} days overdue. Please arrange payment to keep your account in good standing.'
    ),
    para('Amount due: {{invoice.balance}} · {{invoice.overdueDays}} days overdue'),
    button('Pay now', '{{invoice.payUrl}}'),
  ]);

const invoicingOverdueFinal = (): BuilderNode =>
  body([
    heading('Final notice'),
    para(
      'Invoice {{invoice.number}} is now {{invoice.overdueDays}} days overdue and requires immediate attention. This is the final reminder before your account is escalated.'
    ),
    para('Amount due: {{invoice.balance}} · {{invoice.overdueDays}} days overdue'),
    conditional('invoice.overdueDays', [
      para(
        'If payment isn’t received, your account may be placed on credit hold and outstanding orders paused.'
      ),
    ]),
    button('Pay now', '{{invoice.payUrl}}'),
  ]);

const chatSatisfaction = (): BuilderNode =>
  body([
    heading('How did we do?'),
    para(
      'Thanks for chatting with {{tenant.name}}, {{customer.firstName ?? "there"}}. We’d love a quick word on how the conversation went.'
    ),
    button('Rate your chat', '{{tenant.storeUrl}}'),
  ]);

// ── The registry ─────────────────────────────────────────────────────────────

export type EmailTemplateType = 'transactional' | 'marketing';

export interface DefaultEmailTemplate {
  /** Stable key — the automation/override identity (`(tenant, property, key)`). */
  key: string;
  name: string;
  type: EmailTemplateType;
  /** Grouping label for the email catalog (welcome, dunning, invoice, …). */
  category: string;
  /** Subject + inbox preview, with merge tokens resolved at dispatch. */
  subject: string;
  preheader: string;
  /** DataSource roots the tree binds — what the trigger must resolve. */
  sources: string[];
  /** Entity ids the trigger event must supply. */
  refs: string[];
  tree: BuilderNode;
}

/** The 13 default email templates (docs/91 §4). Built once at module load so the
 *  node id sequence is stable across reads (cf. STARTER_PAGES). */
export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    key: 'welcome-customer',
    name: 'Welcome',
    type: 'transactional',
    category: 'welcome',
    subject: 'Welcome to {{tenant.name}}',
    preheader: 'Thanks for joining — here’s what’s next.',
    sources: ['customer', 'tenant'],
    refs: ['customerId'],
    tree: welcomeCustomer(),
  },
  {
    key: 'win-back',
    name: 'Win-back',
    type: 'marketing',
    category: 'win-back',
    subject: 'We miss you, {{customer.firstName ?? "friend"}}',
    preheader: 'Come back and see what’s new.',
    sources: ['customer', 'tenant'],
    refs: ['customerId'],
    tree: winBack(),
  },
  {
    key: 'abandoned-cart',
    name: 'Abandoned cart',
    type: 'marketing',
    category: 'cart-recovery',
    subject: 'You left something behind',
    preheader: 'Your cart is still here.',
    sources: ['customer', 'cart', 'tenant'],
    refs: ['customerId', 'cartId'],
    tree: abandonedCart(),
  },
  {
    key: 'post-purchase-review',
    name: 'Post-purchase review',
    type: 'marketing',
    category: 'review',
    subject: 'How did we do?',
    preheader: 'Tell us about order {{order.number}}.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: postPurchaseReview(),
  },
  {
    key: 'b2b-account-approved',
    name: 'B2B account approved',
    type: 'transactional',
    category: 'notification',
    subject: 'Your account is approved',
    preheader: '{{b2bAccount.companyName}} is ready to order.',
    sources: ['customer', 'b2bAccount', 'tenant'],
    refs: ['customerId', 'b2bAccountId'],
    tree: b2bAccountApproved(),
  },
  {
    key: 'b2b-quote-received',
    name: 'B2B quote received',
    type: 'transactional',
    category: 'notification',
    subject: 'Quote received — {{quote.number}}',
    preheader: 'Here are your quote details.',
    sources: ['customer', 'quote', 'tenant'],
    refs: ['customerId', 'quoteId'],
    tree: b2bQuoteReceived(),
  },
  {
    key: 'b2b-invoice-due',
    name: 'B2B invoice due',
    type: 'transactional',
    category: 'invoice',
    subject: 'Invoice due in {{invoice.daysUntilDue}} days',
    preheader: 'Invoice {{invoice.number}} — {{invoice.balance}} due.',
    sources: ['customer', 'invoice', 'tenant'],
    refs: ['customerId', 'billingDocumentId'],
    tree: b2bInvoiceDue(),
  },
  {
    key: 'b2b-quote-expiring',
    name: 'B2B quote expiring',
    type: 'transactional',
    category: 'notification',
    subject: 'Your quote expires in 48 hours',
    preheader: 'Quote {{quote.number}} expires soon.',
    sources: ['customer', 'quote', 'tenant'],
    refs: ['customerId', 'quoteId'],
    tree: b2bQuoteExpiring(),
  },
  {
    key: 'invoicing-reminder',
    name: 'Invoice reminder',
    type: 'transactional',
    category: 'invoice',
    subject: 'Friendly reminder — {{invoice.number}} due {{invoice.dueDate}}',
    preheader: '{{invoice.balance}} due {{invoice.dueDate}}.',
    sources: ['customer', 'invoice', 'tenant'],
    refs: ['customerId', 'billingDocumentId'],
    tree: invoicingReminder(),
  },
  {
    key: 'invoicing-overdue',
    name: 'Invoice overdue',
    type: 'transactional',
    category: 'dunning',
    subject: 'Invoice {{invoice.number}} is overdue',
    preheader: '{{invoice.balance}} is past due.',
    sources: ['customer', 'invoice', 'tenant'],
    refs: ['customerId', 'billingDocumentId'],
    tree: invoicingOverdue(),
  },
  {
    key: 'invoicing-overdue-2',
    name: 'Invoice overdue — second notice',
    type: 'transactional',
    category: 'dunning',
    subject: 'Second notice — {{invoice.number}}',
    preheader: '{{invoice.balance}} remains unpaid.',
    sources: ['customer', 'invoice', 'tenant'],
    refs: ['customerId', 'billingDocumentId'],
    tree: invoicingOverdue2(),
  },
  {
    key: 'invoicing-overdue-final',
    name: 'Invoice overdue — final notice',
    type: 'transactional',
    category: 'dunning',
    subject: 'Final notice — {{invoice.number}}',
    preheader: 'Immediate action required.',
    sources: ['customer', 'invoice', 'tenant'],
    refs: ['customerId', 'billingDocumentId'],
    tree: invoicingOverdueFinal(),
  },
  {
    key: 'chat-satisfaction',
    name: 'Chat satisfaction',
    type: 'transactional',
    category: 'survey',
    subject: 'How was your experience?',
    preheader: 'Tell us how we did.',
    sources: ['customer', 'tenant'],
    refs: ['customerId'],
    tree: chatSatisfaction(),
  },
];

/** Lookup a default template by key (the provisioning + override-resolution path). */
export function getDefaultEmailTemplate(key: string): DefaultEmailTemplate | undefined {
  return DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key);
}
