// The default email templates sparx provisions on email-module activation
// (docs/91 + docs/93). Unlike the single `welcome` STARTER_EMAIL (seeded on first list),
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
import { silicaDefaultEmail } from './default-emails-silica';
import type { SilicaEmailDocument } from './email-silica';
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

/** The pinned email HEADER node type (docs/52 §1). The wordmark moved OUT of the
 *  renderer's fixed frame INTO the body tree so the author can edit it in
 *  /builder/email — it's the first child of every email, not deletable/draggable
 *  (the registry def marks it `pinned`), and not in the palette (there's only one).
 *  Its LOGO + store name are resolved from the brand at render (never stored on the
 *  node), so it keeps tracking the tenant brand + per-site override; the node holds
 *  only the TREATMENT. The legal footer stays fixed renderer chrome. */
export const EMAIL_WORDMARK_TYPE = 'email_wordmark';

/** A newly-seeded header: the brand lockup (logo + name), left, medium. */
const DEFAULT_WORDMARK_PROPS = { treatment: 'lockup', align: 'left', size: 'md' } as const;

const wordmark = (): BuilderNode =>
  node(EMAIL_WORDMARK_TYPE, { props: { ...DEFAULT_WORDMARK_PROPS } });

/** The email body root — a stacked Section led by the pinned wordmark header. The
 *  legal footer is still the renderer's; the header is now the first body node. */
function body(children: BuilderNode[]): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [wordmark(), ...children],
  });
}

/** Ensure an email body tree leads with its pinned wordmark header (docs/52 §1).
 *  Idempotent — a tree that already starts with an `email_wordmark` is returned
 *  unchanged. Legacy trees authored before the header was editable get one injected
 *  with the default lockup treatment, so EVERY email — old or new — renders + edits
 *  the header consistently and the renderer never needs to add frame chrome. Called
 *  on the editor read path (so the author sees + saves it) and in the renderer (a
 *  safety net for any un-normalized tree that reaches a send). */
export function normalizeEmailTree(tree: BuilderNode): BuilderNode {
  const children = tree.children ?? [];
  const headers = children.filter((c) => c.type === EMAIL_WORDMARK_TYPE);
  // Already correct — exactly one header, and it leads. The common path.
  if (headers.length === 1 && children[0]?.type === EMAIL_WORDMARK_TYPE) return tree;
  // Self-heal: keep the FIRST existing header (preserving the author's treatment),
  // drop any duplicates, and hoist it to the front; inject a default when absent.
  // So the header is always present, single, and first — no matter how the tree
  // was edited (docs/52 §1).
  const rest = children.filter((c) => c.type !== EMAIL_WORDMARK_TYPE);
  const header: BuilderNode = headers[0] ?? {
    id: 'email-wordmark',
    type: EMAIL_WORDMARK_TYPE,
    props: { ...DEFAULT_WORDMARK_PROPS },
  };
  return { ...tree, children: [header, ...rest] };
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
    heading('Welcome to {{site.name}}'),
    para(
      'Hi {{customer.firstName ?? "there"}} — thanks for creating an account. You’re all set: browse the latest, track your orders, and check out faster every time.'
    ),
    button('Start shopping', '{{site.url}}'),
  ]);

const winBack = (): BuilderNode =>
  body([
    heading('It’s been a while'),
    para(
      'We haven’t seen you at {{site.name}} in a bit, {{customer.firstName ?? "there"}}. There’s plenty new since your last visit — come take a look.'
    ),
    button('See what’s new', '{{site.url}}'),
    ...complianceFooter(),
  ]);

const abandonedCart = (): BuilderNode =>
  body([
    heading('Still thinking it over?'),
    para('Your cart is saved and ready whenever you are. Here’s what you left at {{site.name}}:'),
    lineItems('cart.items'),
    para('Total: {{cart.total}}'),
    button('Complete your order', '{{cart.recoveryUrl}}'),
    ...complianceFooter(),
  ]);

const postPurchaseReview = (): BuilderNode =>
  body([
    heading('How was your order?'),
    para(
      'Thanks for shopping with {{site.name}}, {{customer.firstName ?? "there"}}. We’d love to hear what you thought of order {{order.number}}:'
    ),
    lineItems('order.items'),
    button('Leave a review', '{{order.reviewUrl}}'),
    ...complianceFooter(),
  ]);

const b2bAccountApproved = (): BuilderNode =>
  body([
    heading('You’re approved'),
    para(
      'Good news — {{b2bAccount.companyName}} has been approved for a wholesale account with {{site.name}}. You can sign in and order at your account pricing now.'
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

const invoicingReceipt = (): BuilderNode =>
  body([
    heading('Payment received — thank you!'),
    para(
      'We’ve received your payment in full for invoice {{invoice.number}}. Here’s a summary for your records:'
    ),
    lineItems('invoice.items'),
    para('Total paid: {{invoice.total}}'),
  ]);

const chatSatisfaction = (): BuilderNode =>
  body([
    heading('How did we do?'),
    para(
      'Thanks for chatting with {{site.name}}, {{customer.firstName ?? "there"}}. We’d love a quick word on how the conversation went.'
    ),
    button('Rate your chat', '{{site.url}}'),
  ]);

// ── Commerce + scheduling trees (docs/93 — folded in from coded templates) ───

const orderConfirmation = (): BuilderNode =>
  body([
    heading('Your order is confirmed'),
    para(
      'Thanks for your order, {{customer.firstName ?? "there"}} — we’re getting it ready. Here’s a summary of order {{order.number}}:'
    ),
    lineItems('order.items'),
    para('Total: {{order.total}}'),
    conditional('order.shippingAddress.oneLine', [
      para('Shipping to: {{order.shippingAddress.oneLine}}'),
    ]),
    button('View your order', '{{order.statusUrl}}'),
  ]);

const shippingConfirmation = (): BuilderNode =>
  body([
    heading('Your order is on its way'),
    para('Good news, {{customer.firstName ?? "there"}} — order {{order.number}} has shipped.'),
    para('Carrier: {{shipping.carrier}} · Tracking: {{shipping.trackingNumber}}'),
    conditional('shipping.trackingNumber', [
      button('Track your package', '{{shipping.trackingUrl}}'),
    ]),
    lineItems('order.items'),
  ]);

// ── Order lifecycle (docs/implementation/transactional-email §4 P1) — the
// counterparts to order-confirmation: delivered, cancelled, refunded, payment
// problem. Silica bodies carry the polished design; these legacy trees exist only
// because the `draft_tree`/`published_tree` columns are still NOT NULL.

const orderDelivered = (): BuilderNode =>
  body([
    heading('Your order was delivered'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your order {{order.number}} has been delivered. We hope it’s everything you expected.'
    ),
    para('Order total: {{order.total}}'),
    button('Leave a review', '{{order.reviewUrl}}'),
  ]);

const orderCancelled = (): BuilderNode =>
  body([
    heading('Your order was cancelled'),
    para(
      'Hi {{customer.firstName ?? "there"}} — order {{order.number}} has been cancelled. Order total: {{order.total}}.'
    ),
    conditional('order.cancelReason', [para('Reason: {{order.cancelReason}}')]),
    para(
      'If you were charged for this order, a refund will be issued to your original payment method.'
    ),
    button('View order details', '{{order.statusUrl}}'),
  ]);

const orderRefunded = (): BuilderNode =>
  body([
    heading('Your refund is on the way'),
    para(
      'Hi {{customer.firstName ?? "there"}} — we’ve processed a refund of {{order.refundTotal}} for order {{order.number}}.'
    ),
    para(
      'Refunds are returned to your original payment method and usually take 5–10 business days to appear.'
    ),
    button('View order details', '{{order.statusUrl}}'),
  ]);

const paymentFailed = (): BuilderNode =>
  body([
    heading('There was a problem with your payment'),
    para(
      'Hi {{customer.firstName ?? "there"}} — we couldn’t process the payment for order {{order.number}}, so it’s on hold. Amount due: {{order.total}}.'
    ),
    para('Update your payment details to complete your order — we’ll take it from there.'),
    button('Update payment', '{{order.statusUrl}}'),
  ]);

// ── Subscription lifecycle (docs/impl transactional-email §4 P2) — auto-ship
// recurring commerce. Silica bodies carry the design; these legacy trees exist
// only for the NOT-NULL tree columns.

const subscriptionConfirmed = (): BuilderNode =>
  body([
    heading('Your subscription is active'),
    para(
      'Hi {{customer.firstName ?? "there"}} — you’re all set. We’ll send each order automatically, {{subscription.interval}}. Next order: {{subscription.nextOrderDate}} ({{subscription.amount}}).'
    ),
    button('Manage subscription', '{{subscription.manageUrl}}'),
  ]);

const subscriptionRenewed = (): BuilderNode =>
  body([
    heading('Your subscription renewed'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your latest order is on its way. Amount charged: {{subscription.amount}}. Next order: {{subscription.nextOrderDate}}.'
    ),
    button('Manage subscription', '{{subscription.manageUrl}}'),
  ]);

const subscriptionPaymentFailed = (): BuilderNode =>
  body([
    heading('There was a problem with your subscription payment'),
    para(
      'Hi {{customer.firstName ?? "there"}} — we couldn’t process the payment for your latest order ({{subscription.amount}}), so it’s paused. Update your payment details and we’ll retry automatically.'
    ),
    button('Update payment', '{{subscription.manageUrl}}'),
  ]);

const subscriptionPaused = (): BuilderNode =>
  body([
    heading('Your subscription is paused'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your subscription is on hold. No orders will ship until it resumes.'
    ),
    conditional('subscription.pausedUntil', [para('Paused until {{subscription.pausedUntil}}.')]),
    button('Resume subscription', '{{subscription.manageUrl}}'),
  ]);

const subscriptionResumed = (): BuilderNode =>
  body([
    heading('Your subscription is active again'),
    para(
      'Hi {{customer.firstName ?? "there"}} — welcome back. Your subscription has resumed; next order: {{subscription.nextOrderDate}}.'
    ),
    button('Manage subscription', '{{subscription.manageUrl}}'),
  ]);

const subscriptionCancelled = (): BuilderNode =>
  body([
    heading('Your subscription was cancelled'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your subscription has been cancelled and no further orders will ship.'
    ),
    conditional('subscription.currentPeriodEnd', [
      para('You’ll keep access until {{subscription.currentPeriodEnd}}.'),
    ]),
    button('Start a new subscription', '{{subscription.manageUrl}}'),
  ]);

// ── Returns / RMA + B2B order outcomes (docs/impl transactional-email §4 P3).
// Silica bodies carry the design; these legacy trees exist only for the NOT-NULL
// tree columns.

const returnApproved = (): BuilderNode =>
  body([
    heading('Your return is approved'),
    para(
      'Hi {{customer.firstName ?? "there"}} — we’ve approved your return for order {{order.number}} (for a {{return.outcome}}). Pack the items securely and send them back.'
    ),
    conditional('return.hasLabel', [button('Print your return label', '{{return.labelUrl}}')]),
  ]);

const returnReceived = (): BuilderNode =>
  body([
    heading('We’ve received your return'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your return for order {{order.number}} is back with us. We’re processing your {{return.outcome}} and will email you again shortly.'
    ),
    button('View your order', '{{return.manageUrl}}'),
  ]);

const returnRefunded = (): BuilderNode =>
  body([
    heading('Your refund is complete'),
    para(
      'Hi {{customer.firstName ?? "there"}} — we’ve refunded {{return.refundAmount}} for your return on order {{order.number}}. Refunds usually take 5–10 business days to appear.'
    ),
    button('View your order', '{{return.manageUrl}}'),
  ]);

const b2bOrderApproved = (): BuilderNode =>
  body([
    heading('Your order is approved'),
    para(
      'Hi {{customer.firstName ?? "there"}} — order {{order.number}} ({{order.total}}) has been approved and is now being processed.'
    ),
    button('View your order', '{{order.statusUrl}}'),
  ]);

const b2bOrderRejected = (): BuilderNode =>
  body([
    heading('Your order wasn’t approved'),
    para(
      'Hi {{customer.firstName ?? "there"}} — order {{order.number}} wasn’t approved, so it hasn’t been placed. Reach out to your account manager with any questions.'
    ),
    button('View your order', '{{order.statusUrl}}'),
  ]);

// ── Scheduling-module booking trees (docs/79 §10) ────────────────────────────
// The industry-agnostic booking record (appointment | class | reservation |
// rental) — the legacy B2B-fleet `appointment` trees were retired 2026-07-14
// (docs/79 §15.7) once service_appointments was dropped; B2B fleet bookings are
// Bookings too (Booking.b2bAccountId/assetRef), so these cover them as well.
// No vehicle copy — `location` / `staff` are the cross-type optionals instead.

const bookingConfirmation = (): BuilderNode =>
  body([
    heading('Your booking is confirmed'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your {{booking.service}} is booked for {{booking.when}}.'
    ),
    conditional('booking.location', [para('Location: {{booking.location}}')]),
    conditional('booking.staff', [para('With: {{booking.staff}}')]),
    button('Manage booking', '{{booking.manageUrl}}'),
    conditional('booking.addToCalendarUrl', [
      button('Add to calendar', '{{booking.addToCalendarUrl}}'),
    ]),
  ]);

const bookingReminder = (): BuilderNode =>
  body([
    heading('A reminder about your upcoming booking'),
    para(
      'Hi {{customer.firstName ?? "there"}} — a reminder that your {{booking.service}} is coming up on {{booking.when}}.'
    ),
    conditional('booking.location', [para('Location: {{booking.location}}')]),
    conditional('booking.staff', [para('With: {{booking.staff}}')]),
    button('Manage booking', '{{booking.manageUrl}}'),
    conditional('booking.addToCalendarUrl', [
      button('Add to calendar', '{{booking.addToCalendarUrl}}'),
    ]),
  ]);

const bookingRescheduled = (): BuilderNode =>
  body([
    heading('Your booking has been rescheduled'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your {{booking.service}} has been moved to {{booking.when}}.'
    ),
    conditional('booking.location', [para('Location: {{booking.location}}')]),
    button('Manage booking', '{{booking.manageUrl}}'),
    conditional('booking.addToCalendarUrl', [
      button('Add to calendar', '{{booking.addToCalendarUrl}}'),
    ]),
  ]);

const bookingCancelled = (): BuilderNode =>
  body([
    heading('Your booking was cancelled'),
    para(
      'Hi {{customer.firstName ?? "there"}} — your {{booking.service}} scheduled for {{booking.when}} has been cancelled.'
    ),
    conditional('booking.cancellationReason', [para('Reason: {{booking.cancellationReason}}')]),
    button('Book another time', '{{booking.bookUrl}}'),
  ]);

// The owner-facing counterpart of booking-confirmation (docs/79 §10): sent to the
// BUSINESS when someone books online — the assigned host, else the site's inbox —
// so a non-technical owner learns of a booking in their inbox, not by watching a
// dashboard. Still a per-SITE send (identity + brand resolve from the booking's
// property), never the tenant. `booking.newHeadline` reads "New booking request"
// for a requires-approval booking, and `booking.pendingApproval` surfaces the
// action-needed line.
const bookingNotificationInternal = (): BuilderNode =>
  body([
    heading('{{booking.newHeadline}}'),
    para('{{customer.fullName ?? "A customer"}} booked {{booking.service}} for {{booking.when}}.'),
    conditional('booking.pendingApproval', [
      para(
        'This booking is a request awaiting your approval — confirm or decline it from your dashboard.'
      ),
    ]),
    conditional('booking.staff', [para('With: {{booking.staff}}')]),
    conditional('booking.location', [para('Location: {{booking.location}}')]),
    conditional('booking.partySize', [para('Party size: {{booking.partySize}}')]),
    para('Customer: {{customer.fullName ?? "—"}}'),
    para('Email: {{customer.email}}'),
    conditional('customer.company', [para('Company: {{customer.company}}')]),
    conditional('booking.addToCalendarUrl', [
      button('Add to calendar', '{{booking.addToCalendarUrl}}'),
    ]),
  ]);

// A spot opened for a customer on the service waitlist (docs/79 §7). Time-sensitive
// nudge to book before the offer expires; bound to the `waitlist` source.
const waitlistOffer = (): BuilderNode =>
  body([
    heading('A spot just opened up'),
    para(
      'Hi {{customer.firstName ?? "there"}} — good news: a spot opened for {{waitlist.service}} in your requested window ({{waitlist.window}}). Book now to claim it.'
    ),
    conditional('waitlist.offerExpires', [
      para('This offer is held until {{waitlist.offerExpires}}.'),
    ]),
    button('Book your spot', '{{waitlist.bookUrl}}'),
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
  /** The LEGACY sparx body tree. Still provisioned, and still what a send renders for
   *  a tenant whose row predates the silica document (docs/120 parallel-run). */
  tree: BuilderNode;
  /** The SILICA body — the same copy on silicaui's email schema, and what a send
   *  renders once the row carries it. Derived from `key` + `subject` + `preheader`
   *  below, never authored per entry (silica owns subject/preheader, docs/120 D3). */
  doc: SilicaEmailDocument;
}

/** The default email templates (docs/91 §4 + docs/93 §4) — the original 13 plus the
 *  commerce/scheduling emails folded in from coded templates so every tenant→customer
 *  email is Builder-authored. Built once at module load so the node id sequence is
 *  stable across reads (cf. STARTER_PAGES). */
const TEMPLATES: Omit<DefaultEmailTemplate, 'doc'>[] = [
  {
    key: 'welcome-customer',
    name: 'Welcome',
    type: 'transactional',
    category: 'welcome',
    subject: 'Welcome to {{site.name}}',
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
    key: 'invoicing-receipt',
    name: 'Payment receipt',
    type: 'transactional',
    category: 'invoice',
    subject: 'Receipt — {{invoice.number}} paid in full',
    preheader: 'Thank you for your payment.',
    sources: ['customer', 'invoice', 'tenant'],
    refs: ['customerId', 'billingDocumentId'],
    tree: invoicingReceipt(),
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
  {
    key: 'order-confirmation',
    name: 'Order confirmation',
    type: 'transactional',
    category: 'order',
    subject: 'Your order {{order.number}} is confirmed',
    preheader: 'Thanks for your order — here are the details.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: orderConfirmation(),
  },
  {
    key: 'shipping-confirmation',
    name: 'Shipping confirmation',
    type: 'transactional',
    category: 'order',
    subject: 'Your order {{order.number}} has shipped',
    preheader: 'It’s on the way — track your package.',
    sources: ['customer', 'order', 'shipping', 'tenant'],
    refs: ['customerId', 'orderId', 'fulfillmentId'],
    tree: shippingConfirmation(),
  },
  {
    key: 'order-delivered',
    name: 'Order delivered',
    type: 'transactional',
    category: 'order',
    subject: 'Your order {{order.number}} was delivered',
    preheader: 'It’s arrived — we hope you love it.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: orderDelivered(),
  },
  {
    key: 'order-cancelled',
    name: 'Order cancelled',
    type: 'transactional',
    category: 'order',
    subject: 'Your order {{order.number}} was cancelled',
    preheader: 'About your recent order.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: orderCancelled(),
  },
  {
    key: 'order-refunded',
    name: 'Order refunded',
    type: 'transactional',
    category: 'order',
    subject: 'Your refund for {{order.number}} is on the way',
    preheader: '{{order.refundTotal}} is being returned to you.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: orderRefunded(),
  },
  {
    key: 'payment-failed',
    name: 'Payment failed',
    type: 'transactional',
    category: 'order',
    subject: 'There was a problem with your payment',
    preheader: 'Your order {{order.number}} is on hold.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: paymentFailed(),
  },
  {
    key: 'subscription-confirmed',
    name: 'Subscription confirmed',
    type: 'transactional',
    category: 'subscription',
    subject: 'Your subscription is active',
    preheader: 'Next order {{subscription.nextOrderDate}}.',
    sources: ['customer', 'subscription', 'tenant'],
    refs: ['customerId', 'subscriptionId'],
    tree: subscriptionConfirmed(),
  },
  {
    key: 'subscription-renewed',
    name: 'Subscription renewed',
    type: 'transactional',
    category: 'subscription',
    subject: 'Your subscription renewed',
    preheader: 'Your latest order is on its way.',
    sources: ['customer', 'subscription', 'tenant'],
    refs: ['customerId', 'subscriptionId'],
    tree: subscriptionRenewed(),
  },
  {
    key: 'subscription-payment-failed',
    name: 'Subscription payment failed',
    type: 'transactional',
    category: 'subscription',
    subject: 'There was a problem with your subscription payment',
    preheader: 'Update your payment to keep your subscription active.',
    sources: ['customer', 'subscription', 'tenant'],
    refs: ['customerId', 'subscriptionId'],
    tree: subscriptionPaymentFailed(),
  },
  {
    key: 'subscription-paused',
    name: 'Subscription paused',
    type: 'transactional',
    category: 'subscription',
    subject: 'Your subscription is paused',
    preheader: 'No orders will ship until it resumes.',
    sources: ['customer', 'subscription', 'tenant'],
    refs: ['customerId', 'subscriptionId'],
    tree: subscriptionPaused(),
  },
  {
    key: 'subscription-resumed',
    name: 'Subscription resumed',
    type: 'transactional',
    category: 'subscription',
    subject: 'Your subscription is active again',
    preheader: 'Next order {{subscription.nextOrderDate}}.',
    sources: ['customer', 'subscription', 'tenant'],
    refs: ['customerId', 'subscriptionId'],
    tree: subscriptionResumed(),
  },
  {
    key: 'subscription-cancelled',
    name: 'Subscription cancelled',
    type: 'transactional',
    category: 'subscription',
    subject: 'Your subscription was cancelled',
    preheader: 'About your recent subscription.',
    sources: ['customer', 'subscription', 'tenant'],
    refs: ['customerId', 'subscriptionId'],
    tree: subscriptionCancelled(),
  },
  {
    key: 'return-approved',
    name: 'Return approved',
    type: 'transactional',
    category: 'return',
    subject: 'Your return for {{order.number}} is approved',
    preheader: 'Here’s how to send your items back.',
    sources: ['customer', 'order', 'return', 'tenant'],
    refs: ['customerId', 'orderId', 'returnId'],
    tree: returnApproved(),
  },
  {
    key: 'return-received',
    name: 'Return received',
    type: 'transactional',
    category: 'return',
    subject: 'We’ve received your return',
    preheader: 'Your return for {{order.number}} is back with us.',
    sources: ['customer', 'order', 'return', 'tenant'],
    refs: ['customerId', 'orderId', 'returnId'],
    tree: returnReceived(),
  },
  {
    key: 'return-refunded',
    name: 'Return refunded',
    type: 'transactional',
    category: 'return',
    subject: 'Your refund for {{order.number}} is complete',
    preheader: '{{return.refundAmount}} has been refunded.',
    sources: ['customer', 'order', 'return', 'tenant'],
    refs: ['customerId', 'orderId', 'returnId'],
    tree: returnRefunded(),
  },
  {
    key: 'b2b-order-approved',
    name: 'B2B order approved',
    type: 'transactional',
    category: 'notification',
    subject: 'Your order {{order.number}} is approved',
    preheader: 'It’s approved and being processed.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: b2bOrderApproved(),
  },
  {
    key: 'b2b-order-rejected',
    name: 'B2B order rejected',
    type: 'transactional',
    category: 'notification',
    subject: 'About your order {{order.number}}',
    preheader: 'Your order wasn’t approved.',
    sources: ['customer', 'order', 'tenant'],
    refs: ['customerId', 'orderId'],
    tree: b2bOrderRejected(),
  },
  {
    key: 'booking-confirmation',
    name: 'Booking confirmation',
    type: 'transactional',
    category: 'scheduling',
    subject: 'Your booking is confirmed',
    preheader: '{{booking.service}} on {{booking.when}}.',
    sources: ['customer', 'booking', 'tenant'],
    refs: ['customerId', 'bookingId'],
    tree: bookingConfirmation(),
  },
  {
    key: 'booking-reminder',
    name: 'Booking reminder',
    type: 'transactional',
    category: 'scheduling',
    subject: 'Reminder: your booking on {{booking.date}}',
    preheader: '{{booking.service}} on {{booking.when}}.',
    sources: ['customer', 'booking', 'tenant'],
    refs: ['customerId', 'bookingId'],
    tree: bookingReminder(),
  },
  {
    key: 'booking-rescheduled',
    name: 'Booking rescheduled',
    type: 'transactional',
    category: 'scheduling',
    subject: 'Your booking has been rescheduled',
    preheader: 'Now {{booking.when}}.',
    sources: ['customer', 'booking', 'tenant'],
    refs: ['customerId', 'bookingId'],
    tree: bookingRescheduled(),
  },
  {
    key: 'booking-cancelled',
    name: 'Booking cancelled',
    type: 'transactional',
    category: 'scheduling',
    subject: 'Your booking was cancelled',
    preheader: 'About your {{booking.service}}.',
    sources: ['customer', 'booking', 'tenant'],
    refs: ['customerId', 'bookingId'],
    tree: bookingCancelled(),
  },
  {
    key: 'waitlist-offer',
    name: 'Waitlist offer',
    type: 'transactional',
    category: 'scheduling',
    subject: 'A spot opened for {{waitlist.service}}',
    preheader: 'Book before {{waitlist.offerExpires}}.',
    sources: ['customer', 'waitlist', 'tenant'],
    refs: ['customerId', 'waitlistEntryId'],
    tree: waitlistOffer(),
  },
  {
    key: 'booking-notification-internal',
    name: 'New booking (internal)',
    type: 'transactional',
    category: 'scheduling',
    subject: '{{booking.newHeadline}}: {{booking.service}}',
    preheader: '{{customer.fullName ?? "A customer"}} — {{booking.when}}.',
    sources: ['customer', 'booking', 'tenant'],
    refs: ['customerId', 'bookingId'],
    tree: bookingNotificationInternal(),
  },
];

/** Each template with its silica body attached. Derived rather than authored per entry
 *  so subject/preheader exist in exactly one place — and so `silicaDefaultEmail`'s
 *  throw fires at MODULE LOAD for any template missing a silica body, rather than
 *  letting it provision silently as a legacy-only email. */
export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = TEMPLATES.map((t) => ({
  ...t,
  doc: silicaDefaultEmail(t.key, t.subject, t.preheader),
}));

/** Lookup a default template by key (the provisioning + override-resolution path). */
export function getDefaultEmailTemplate(key: string): DefaultEmailTemplate | undefined {
  return DEFAULT_EMAIL_TEMPLATES.find((t) => t.key === key);
}
