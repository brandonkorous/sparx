// The silica-native bodies for the provisioned default emails (docs/120 slice 6).
//
// The same copy as the legacy `BuilderNode` trees in `default-emails.ts`, re-authored
// against silicaui's closed email schema. Both ship: provisioning writes the silica
// document AND keeps the legacy tree, and a send prefers the silica document —
// parallel-run (docs/120 D1), so a tenant provisioned before this landed keeps sending
// through `renderEmailTree` until they open the email and save it.
//
// Two things the tree carried that a silica body deliberately does NOT:
//   · the `email_wordmark` header — the send composes the brand header (an author who
//     deleted it used to get an unbranded email);
//   · the marketing `unsubscribe_link` + `physical_address` footer — the send composes
//     the legal footer on every marketing send, so CAN-SPAM compliance is structural
//     rather than something an author can delete off the bottom of the email.
//
// Merge tokens stay `{{source.field}}`, unchanged — silica interpolates them natively
// in copy and button labels, and the send covers links. No author relearns anything.
//
// ── Why no default uses `?? "fallback"` any more ────────────────────────────
// It used to. `Hi {{customer.firstName ?? "there"}}` appeared 29 times, and the note
// here explained that it survived "via a happy interaction": silica's own token regex
// matches bare `[a-zA-Z0-9_.]` paths, so a token carrying `??` doesn't match, passes
// through projection verbatim, and is interpolated afterwards by sparx's
// `interpolateEmailTokens` pass over the projected HTML, which does understand it.
//
// That reasoning only ever considered the SEND. On the builder CANVAS nothing runs that
// second pass — silica renders the copy directly — so every one of those tokens sat in
// the editor as literal braces while an author worked on the email. The interaction was
// not happy; it was invisible until someone opened the thing.
//
// So the greeting is a merge tag that cannot come out blank: `customer.greeting` and
// `customer.displayName`, derived at send time by `deriveCustomerNames`. Bare paths,
// which silica matches, so canvas and inbox now agree — and an owner picking a tag from
// the reference list never meets `??` syntax in a product built for people who do not
// write software. Without either, a customer with no first name reads "Hi  — thanks".
//
// `??` remains fully supported for anyone who wants a per-sentence fallback (see
// `email/src/silica/__tests__/merge-token-fallbacks.test.ts`) — it is simply not
// something sparx's own templates need, and `email-canvas-tokens.test.ts` keeps them
// that way.

import type { SectionNode } from '@wizeworks/silicaui-builder/email';

import {
    actionLink,
    button,
    contentRail,
    copyBlock,
    costSummary,
    detailPanel,
    emailDoc,
    featureList,
    heading,
    itemsTable,
    moduleFeature,
    para,
    productRail,
    text,
    when,
    type DetailStatus,
} from './silica-email-kit';
import type { SilicaEmailDocument } from './email-silica';

// ── Welcome / lifecycle ──────────────────────────────────────────────────────

// The welcome is the ONE lifecycle "orientation" email (docs/impl transactional-email
// cross-sell): it stays transactional-safe (no hard sell, one neutral CTA) but its body
// reflects what the business actually DOES, gated on the active modules. A seller gets
// the "shop" card, a booking business the "book" card, a publisher the "read" card, a
// wholesale buyer the "account" card — each self-drops when its module is off. The
// universal card is always shown, so a tenant with no customer-facing module (or a
// brand-new one) is never left with a bare heading. Copy is capability guidance, not a
// promotion, which is what keeps it out of CAN-SPAM's marketing bucket.
const welcomeCustomer = (): SectionNode[] => [
    copyBlock([
        heading('Welcome to {{site.name}}'),
        para(
            'Hi {{customer.greeting}}, thanks for creating an account — we’re glad you’re here. Here’s what your account can do:'
        ),
    ]),
    moduleFeature(
        'commerce',
        'Shop the full collection',
        'Browse everything at {{site.name}} and check out in seconds — your details are saved, so your next order is just a tap away.'
    ),
    moduleFeature(
        'scheduling',
        'Book online, anytime',
        'Reserve a time that works for you and manage every booking from your account — no phone tag.'
    ),
    moduleFeature(
        'b2b',
        'Your wholesale account',
        'See your account pricing, place orders, and keep track of quotes and invoices in one place.'
    ),
    moduleFeature(
        'cms',
        'Read the latest',
        'Catch up on new stories and updates from {{site.name}} the moment they land.'
    ),
    featureList([
        {
            title: 'Everything in one place',
            body: 'Your details and history are always a click away — sign in any time to pick up where you left off.',
        },
        {
            title: 'We’re here to help',
            body: 'Reply to any email from us and you’ll reach a real person, not a bot.',
        },
    ]),
    // Orient a new customer to what the business publishes — the latest stories, each
    // deep-linked. Drops entirely for a tenant with no CMS content, so a commerce-only
    // store never shows an empty "read the latest" block.
    ...contentRail({
        heading: 'Fresh from {{site.name}}',
        ctaLabel: 'Read the latest',
        ctaHref: '{{site.url}}',
    }),
    copyBlock([
        button('Visit {{site.name}}', '{{site.url}}', 'center'),
        text('We’re glad you’re here — welcome aboard.', { align: 'center' }),
    ]),
];

const winBack = (): SectionNode[] => [
    copyBlock([
        heading('It’s been a while'),
        para(
            'We haven’t seen you at {{site.name}} in a bit, {{customer.greeting}}. There’s plenty new since your last visit — come take a look.'
        ),
        button('See what’s new', '{{site.url}}', 'center'),
    ]),
    // Fresh content is the strongest re-engagement hook a publisher has — the latest
    // stories, each deep-linked. The whole rail drops for a tenant without the CMS module.
    ...contentRail({
        heading: 'The latest from {{site.name}}',
        ctaLabel: 'Read more',
        ctaHref: '{{site.url}}',
    }),
];

const abandonedCart = (): SectionNode[] => [
    copyBlock([
        heading('Still thinking it over?'),
        para('Your cart is saved and ready whenever you are. Here’s what you left at {{site.name}}:'),
    ]),
    // The highest-return email a store sends — the products, shown with their pictures, so
    // the customer sees exactly what they were about to buy.
    ...itemsTable('cart.items', { thumbnails: true }),
    // A single-row total callout — the items above ARE the summary, so the card just
    // anchors the amount rather than repeating a record header.
    detailPanel([{ label: 'Cart total', value: '{{cart.total}}', emphasize: true }]),
    copyBlock([
        button('Complete your order', '{{cart.recoveryUrl}}', 'center'),
        para('Items in your cart aren’t reserved — check out to make them yours.'),
    ]),
    // Marketing send (under the unsubscribe footer), so a cross-sell rail earns its place —
    // the mechanism that turns a saved cart into a bigger order, each card deep-linked.
    ...productRail({
        heading: 'You might also like',
        ctaLabel: 'Browse the collection',
        ctaHref: '{{site.url}}',
    }),
];

const postPurchaseReview = (): SectionNode[] => [
    copyBlock([
        heading('How was your order?'),
        para(
            'Thanks for shopping with {{site.name}}, {{customer.greeting}}. We’d love to hear what you thought of order {{order.number}}:'
        ),
    ]),
    ...itemsTable('order.items', { thumbnails: true }),
    copyBlock([button('Leave a review', '{{order.reviewUrl}}', 'center')]),
    // A marketing send (rides under the unsubscribe footer), so a product rail of what
    // else they might like is welcome — each card deep-links to its own page.
    ...productRail({
        heading: 'More to explore',
        ctaLabel: 'Shop the collection',
        ctaHref: '{{site.url}}',
    }),
    // …and, for a content-and-commerce business, the latest stories too — post-purchase is
    // a strong engagement moment. Drops entirely for a store with no CMS content.
    ...contentRail({
        heading: 'From the {{site.name}} journal',
        ctaLabel: 'Read the latest',
        ctaHref: '{{site.url}}',
    }),
];

const chatSatisfaction = (): SectionNode[] => [
    copyBlock([
        heading('How did we do?'),
        para(
            'Thanks for chatting with {{site.name}}, {{customer.greeting}}. We’d love a quick word on how the conversation went.'
        ),
        button('Rate your chat', '{{site.url}}', 'center'),
    ]),
];

// ── B2B ──────────────────────────────────────────────────────────────────────

const b2bAccountApproved = (): SectionNode[] => [
    copyBlock([
        heading('You’re approved'),
        para(
            'Good news — {{b2bAccount.companyName}} has been approved for a wholesale account with {{site.name}}. You can sign in and order at your account pricing now.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Account', value: '{{b2bAccount.companyName}}' },
            { label: 'Credit line', value: '{{b2bAccount.creditLimit}}', ref: 'b2bAccount.creditLimit' },
            {
                label: 'Payment terms',
                value: '{{b2bAccount.paymentTerms}}',
                ref: 'b2bAccount.paymentTerms',
            },
        ],
        { status: { label: '✓ Approved', role: 'success' } }
    ),
    copyBlock([button('Go to your portal', '{{b2bAccount.portalUrl}}', 'center')]),
];

const b2bQuoteReceived = (): SectionNode[] => [
    copyBlock([
        heading('Your quote is ready'),
        para('Here are the details for quote {{quote.number}} from {{site.name}}:'),
    ]),
    detailPanel(
        [
            { label: 'Quote', value: '{{quote.number}}' },
            { label: 'Quote total', value: '{{quote.total}}', emphasize: true },
            { label: 'Valid until', value: '{{quote.validUntil}}', ref: 'quote.validUntil' },
        ],
        { status: { label: 'Ready to review', role: 'info' } }
    ),
    ...itemsTable('quote.items'),
    copyBlock([button('Review &amp; approve', '{{quote.reviewUrl}}', 'center')]),
];

const b2bQuoteExpiring = (): SectionNode[] => [
    copyBlock([
        heading('Your quote expires soon'),
        para(
            'Heads-up — quote {{quote.number}} expires on {{quote.validUntil}}. Approve it before then to lock in your pricing.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Quote', value: '{{quote.number}}' },
            { label: 'Quote total', value: '{{quote.total}}', emphasize: true },
            { label: 'Expires', value: '{{quote.validUntil}}' },
        ],
        { status: { label: 'Expires soon', role: 'warning' } }
    ),
    copyBlock([button('Approve now', '{{quote.reviewUrl}}', 'center')]),
];

const b2bInvoiceDue = (): SectionNode[] => [
    copyBlock([
        heading('Your invoice is due soon'),
        para('A reminder that invoice {{invoice.number}} is due in {{invoice.daysUntilDue}} days.'),
    ]),
    detailPanel(
        [
            { label: 'Invoice', value: '{{invoice.number}}' },
            { label: 'Amount due', value: '{{invoice.balance}}', emphasize: true },
            { label: 'Due date', value: '{{invoice.dueDate}}' },
        ],
        { status: { label: 'Due soon', role: 'info' } }
    ),
    copyBlock([button('Pay now', '{{invoice.payUrl}}', 'center')]),
];

// ── Invoicing + dunning ──────────────────────────────────────────────────────

const invoicingReminder = (): SectionNode[] => [
    copyBlock([
        heading('A quick reminder'),
        para(
            'Just a friendly reminder that invoice {{invoice.number}} is due on {{invoice.dueDate}}. Here’s a summary:'
        ),
    ]),
    detailPanel(
        [
            { label: 'Invoice', value: '{{invoice.number}}' },
            { label: 'Balance due', value: '{{invoice.balance}}', emphasize: true },
            { label: 'Due date', value: '{{invoice.dueDate}}' },
        ],
        { status: { label: 'Due soon', role: 'info' } }
    ),
    ...itemsTable('invoice.items'),
    copyBlock([button('Pay invoice', '{{invoice.payUrl}}', 'center')]),
];

/** The three dunning notices differ only in tone + escalation, so they share a shape:
 *  a heading + copy, then the summary card whose STATUS escalates
 *  (warning → warning → error) and whose balance is the emphasized hero, then the
 *  Pay CTA. `tail` carries the final notice's credit-hold warning. */
const dunning = (
    title: string,
    body: string,
    status: DetailStatus,
    tail?: SectionNode[]
): SectionNode[] => [
        copyBlock([heading(title), para(body)]),
        detailPanel(
            [
                { label: 'Invoice', value: '{{invoice.number}}' },
                { label: 'Amount due', value: '{{invoice.balance}}', emphasize: true },
                { label: 'Days overdue', value: '{{invoice.overdueDays}}' },
            ],
            { status }
        ),
        ...(tail ?? []),
        copyBlock([button('Pay now', '{{invoice.payUrl}}', 'center')]),
    ];

const invoicingOverdue = (): SectionNode[] =>
    dunning(
        'Your invoice is past due',
        'Invoice {{invoice.number}} was due on {{invoice.dueDate}} and is now {{invoice.overdueDays}} days overdue. Please submit payment at your earliest convenience.',
        { label: 'Past due', role: 'warning' }
    );

const invoicingOverdue2 = (): SectionNode[] =>
    dunning(
        'Second notice',
        'Our records show invoice {{invoice.number}} remains unpaid and is now {{invoice.overdueDays}} days overdue. Please arrange payment to keep your account in good standing.',
        { label: 'Second notice', role: 'warning' }
    );

const invoicingOverdueFinal = (): SectionNode[] =>
    dunning(
        'Final notice',
        'Invoice {{invoice.number}} is now {{invoice.overdueDays}} days overdue and requires immediate attention. This is the final reminder before your account is escalated.',
        { label: 'Final notice', role: 'error' },
        [
            when('invoice.overdueDays', [
                para(
                    'If payment isn’t received, your account may be placed on credit hold and outstanding orders paused.'
                ),
            ]),
        ]
    );

const invoicingReceipt = (): SectionNode[] => [
    copyBlock([
        heading('Payment received — thank you!'),
        para(
            'We’ve received your payment in full for invoice {{invoice.number}}. Here’s a summary for your records:'
        ),
    ]),
    detailPanel(
        [
            { label: 'Invoice', value: '{{invoice.number}}' },
            { label: 'Total paid', value: '{{invoice.total}}', emphasize: true },
        ],
        { status: { label: '✓ Paid', role: 'success' } }
    ),
    ...itemsTable('invoice.items'),
];

// ── Commerce ─────────────────────────────────────────────────────────────────

const orderConfirmation = (): SectionNode[] => [
    copyBlock([
        text('✓ Order confirmed', { size: 14, weight: 'semibold', colorRole: 'success' }),
        heading('Thanks, {{customer.greeting}} — your order’s in.'),
        para(
            'We’re getting order {{order.number}} ready. We’ll email you tracking the moment it ships.'
        ),
    ]),
    // The receipt — product thumbnails so the customer recognises what they bought, then
    // the money math (subtotal · shipping · total) set off with the total in the brand
    // color. This is the core-tier receipt system, and commerce earns the rich thumbnails.
    ...itemsTable('order.items', { thumbnails: true }),
    costSummary([
        { label: 'Subtotal', value: '{{order.subtotal}}', ref: 'order.subtotal' },
        { label: 'Discount', value: '−{{order.discountTotal}}', ref: 'order.discountTotal' },
        { label: 'Shipping', value: '{{order.shippingTotal}}', ref: 'order.shippingTotal' },
        { label: 'Tax', value: '{{order.taxTotal}}', ref: 'order.taxTotal' },
        { label: 'Total', value: '{{order.total}}', strong: true },
    ]),
    // Ship-to as its own scannable panel. The resolver supplies `order.shippingAddress`
    // as an already-formatted one-line string; the WHOLE card drops for a digital order
    // with no shipping address (the `ref` on the panel), so no empty box is left behind.
    detailPanel([{ label: 'Shipping to', value: '{{order.shippingAddress}}' }], {
        ref: 'order.shippingAddress',
    }),
    copyBlock([button('Track your order', '{{order.statusUrl}}', 'center')]),
    // A single incidental product rail under fully transactional content (the order is the
    // email's primary purpose — CAN-SPAM primary-purpose test). Positive moment, so a
    // gentle cross-sell rail fits.
    ...productRail({
        heading: 'Pairs well with',
        ctaLabel: 'Keep shopping',
        ctaHref: '{{site.url}}',
    }),
];

const shippingConfirmation = (): SectionNode[] => [
    copyBlock([
        heading('Your order is on its way'),
        para('Good news, {{customer.greeting}} — order {{order.number}} has shipped.'),
    ]),
    detailPanel(
        [
            { label: 'Carrier', value: '{{shipping.carrier}}', ref: 'shipping.carrier' },
            // The tracking number is what the recipient opened the email for — the hero.
            {
                label: 'Tracking number',
                value: '{{shipping.trackingNumber}}',
                emphasize: true,
                ref: 'shipping.trackingNumber',
            },
        ],
        { status: { label: 'Shipped', role: 'info' } }
    ),
    when('shipping.trackingNumber', [
        button('Track your package', '{{shipping.trackingUrl}}', 'center'),
    ]),
    ...itemsTable('order.items', { thumbnails: true }),
];

// ── Commerce: order lifecycle (docs/implementation/transactional-email §4 P1) ─
// The counterparts to order-confirmation that were missing: the "delivered",
// "cancelled", "refunded", and "payment problem" moments. Each is triggered by a
// system-automation seed on the matching `order.*` event and resolves the same
// `order` data source, so it reads the same tokens as order-confirmation plus the
// three the resolver was extended with (refundTotal · cancelReason · deliveredAt).

const orderDelivered = (): SectionNode[] => [
    copyBlock([
        heading('Your order was delivered'),
        para(
            'Hi {{customer.greeting}} — your order {{order.number}} has been delivered. We hope it’s everything you expected.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Order total', value: '{{order.total}}', emphasize: true },
            { label: 'Delivered', value: '{{order.deliveredAt}}', ref: 'order.deliveredAt' },
        ],
        { status: { label: '✓ Delivered', role: 'success' } }
    ),
    copyBlock([
        button('Leave a review', '{{order.reviewUrl}}', 'center'),
        para('Something not right? Reply to this email and we’ll make it right.'),
    ]),
    // Delivery is the natural re-purchase moment — a rail of fresh picks, each deep-linked.
    ...productRail({
        heading: 'Ready for your next find?',
        ctaLabel: 'Shop the collection',
        ctaHref: '{{site.url}}',
    }),
    // Content-and-commerce businesses get their latest stories under it too — drops for a
    // store with no CMS content.
    ...contentRail({
        heading: 'While it’s fresh',
        ctaLabel: 'Read the latest',
        ctaHref: '{{site.url}}',
    }),
];

const orderCancelled = (): SectionNode[] => [
    copyBlock([
        heading('Your order was cancelled'),
        para(
            'Hi {{customer.greeting}} — order {{order.number}} has been cancelled. Here’s a summary of what was cancelled:'
        ),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Order total', value: '{{order.total}}', emphasize: true },
            { label: 'Reason', value: '{{order.cancelReason}}', ref: 'order.cancelReason' },
        ],
        { status: { label: 'Cancelled', role: 'error' } }
    ),
    copyBlock([
        button('View order details', '{{order.statusUrl}}', 'center'),
        para(
            'If you were charged for this order, a refund will be issued to your original payment method.'
        ),
    ]),
];

const orderRefunded = (): SectionNode[] => [
    copyBlock([
        heading('Your refund is on the way'),
        para('Hi {{customer.greeting}} — we’ve processed a refund for order {{order.number}}.'),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            // The amount coming back is the one fact the recipient opened the email for.
            { label: 'Refund amount', value: '{{order.refundTotal}}', emphasize: true },
            { label: 'Order total', value: '{{order.total}}' },
        ],
        { status: { label: '✓ Refunded', role: 'success' } }
    ),
    copyBlock([
        button('View order details', '{{order.statusUrl}}', 'center'),
        para(
            'Refunds are returned to your original payment method and usually take 5–10 business days to appear.'
        ),
    ]),
];

const paymentFailed = (): SectionNode[] => [
    copyBlock([
        heading('There was a problem with your payment'),
        para(
            'Hi {{customer.greeting}} — we couldn’t process the payment for order {{order.number}}, so it’s on hold for now.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Amount due', value: '{{order.total}}', emphasize: true },
        ],
        { status: { label: 'Action needed', role: 'warning' } }
    ),
    copyBlock([
        button('Update payment', '{{order.statusUrl}}', 'center'),
        para('Update your payment details to complete your order — we’ll take it from there.'),
    ]),
];

// ── Commerce: subscription lifecycle (docs/impl transactional-email §4 P2) ────
// Auto-ship recurring commerce. Each is triggered by a system-automation seed on
// the matching `subscription.*` event and reads the `subscription` data source
// (status · interval · amount · nextOrderDate · pausedUntil · manageUrl).

const subscriptionConfirmed = (): SectionNode[] => [
    copyBlock([
        heading('Your subscription is active'),
        para(
            'Hi {{customer.greeting}} — you’re all set. We’ll take care of the rest and send each order automatically.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Delivery', value: '{{subscription.interval}}' },
            { label: 'Next order', value: '{{subscription.nextOrderDate}}', emphasize: true },
            { label: 'Each order', value: '{{subscription.amount}}' },
        ],
        { status: { label: '✓ Active', role: 'success' } }
    ),
    copyBlock([
        button('Manage subscription', '{{subscription.manageUrl}}', 'center'),
        para('Skip an order, change the delivery date, or cancel any time — it’s all in your account.'),
    ]),
];

const subscriptionRenewed = (): SectionNode[] => [
    copyBlock([
        heading('Your subscription renewed'),
        para(
            'Hi {{customer.greeting}} — your latest order is on its way. Here’s a summary for your records:'
        ),
    ]),
    detailPanel(
        [
            { label: 'Amount charged', value: '{{subscription.amount}}', emphasize: true },
            { label: 'Delivery', value: '{{subscription.interval}}' },
            {
                label: 'Next order',
                value: '{{subscription.nextOrderDate}}',
                ref: 'subscription.nextOrderDate',
            },
        ],
        { status: { label: '✓ Renewed', role: 'success' } }
    ),
    copyBlock([button('Manage subscription', '{{subscription.manageUrl}}', 'center')]),
];

const subscriptionPaymentFailed = (): SectionNode[] => [
    copyBlock([
        heading('There was a problem with your subscription payment'),
        para(
            'Hi {{customer.greeting}} — we couldn’t process the payment for your latest order, so it’s paused for now.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Amount due', value: '{{subscription.amount}}', emphasize: true },
            { label: 'Delivery', value: '{{subscription.interval}}' },
        ],
        { status: { label: 'Action needed', role: 'warning' } }
    ),
    copyBlock([
        button('Update payment', '{{subscription.manageUrl}}', 'center'),
        para('Update your payment details and we’ll retry automatically — no need to reorder.'),
    ]),
];

const subscriptionPaused = (): SectionNode[] => [
    copyBlock([
        heading('Your subscription is paused'),
        para(
            'Hi {{customer.greeting}} — your subscription is on hold. You won’t be charged and no orders will ship until it resumes.'
        ),
    ]),
    detailPanel(
        [
            {
                label: 'Paused until',
                value: '{{subscription.pausedUntil}}',
                emphasize: true,
                ref: 'subscription.pausedUntil',
            },
            { label: 'Delivery', value: '{{subscription.interval}}' },
        ],
        { status: { label: 'Paused', role: 'info' } }
    ),
    copyBlock([
        button('Resume subscription', '{{subscription.manageUrl}}', 'center'),
        para('Ready sooner? You can resume any time from your account.'),
    ]),
];

const subscriptionResumed = (): SectionNode[] => [
    copyBlock([
        heading('Your subscription is active again'),
        para(
            'Hi {{customer.greeting}} — welcome back. Your subscription has resumed and your next order is scheduled.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Next order', value: '{{subscription.nextOrderDate}}', emphasize: true },
            { label: 'Delivery', value: '{{subscription.interval}}' },
            { label: 'Each order', value: '{{subscription.amount}}' },
        ],
        { status: { label: '✓ Active', role: 'success' } }
    ),
    copyBlock([button('Manage subscription', '{{subscription.manageUrl}}', 'center')]),
];

const subscriptionCancelled = (): SectionNode[] => [
    copyBlock([
        heading('Your subscription was cancelled'),
        para(
            'Hi {{customer.greeting}} — your subscription has been cancelled and no further orders will ship.'
        ),
    ]),
    detailPanel(
        [
            {
                label: 'Access until',
                value: '{{subscription.currentPeriodEnd}}',
                ref: 'subscription.currentPeriodEnd',
            },
            { label: 'Delivery', value: '{{subscription.interval}}' },
        ],
        { status: { label: 'Cancelled', role: 'error' } }
    ),
    copyBlock([
        button('Start a new subscription', '{{subscription.manageUrl}}', 'center'),
        para('Changed your mind? You can start a new subscription whenever you’re ready.'),
    ]),
];

// The bank wants the cardholder to confirm (docs/142 §5.3). Deliberately NOT
// worded as a failure: the card is fine and the customer has done nothing wrong,
// so the tone is "one tap needed", not "there was a problem". Getting this wrong
// makes people cancel a subscription they were happy with.
const subscriptionAuthenticationRequired = (): SectionNode[] => [
    copyBlock([
        heading('Your bank needs you to confirm this payment'),
        para(
            'Hi {{customer.greeting}} — your card is fine, but your bank asked us to check it’s really you before your next order goes through. It only takes a moment.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Amount', value: '{{subscription.amount}}', emphasize: true },
            { label: 'Delivery', value: '{{subscription.interval}}' },
        ],
        { status: { label: 'One step left', role: 'info' } }
    ),
    copyBlock([
        button('Confirm payment', '{{subscription.confirmUrl}}', 'center'),
        para('Once you confirm, your order ships as usual — nothing else to do.'),
    ]),
];

// Invoice mode (docs/142 §8) — the renewal was billed rather than charged. This
// is the normal monthly email for an account on terms, so it reads as a routine
// bill and not as something going wrong.
const subscriptionInvoice = (): SectionNode[] => [
    copyBlock([
        heading('Your repeat order is ready'),
        para(
            'Hi {{customer.greeting}} — here’s the bill for your latest order. Once it’s paid we’ll get it on its way.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Amount due', value: '{{subscription.amount}}', emphasize: true },
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Delivery', value: '{{subscription.interval}}' },
        ],
        { status: { label: 'Awaiting payment', role: 'info' } }
    ),
    copyBlock([
        button('Pay now', '{{subscription.payUrl}}', 'center'),
        para('Prefer to pay the way you usually do? That works too — just reply and let us know.'),
    ]),
];

// ── Commerce: returns / RMA (docs/impl transactional-email §4 P3) ────────────
// Triggered on `return.approved` / `return.received` / `return.refunded`; read the
// `return` data source (status · outcome · refundAmount · refundMethod · labelUrl)
// plus the `order` source for the order number.

const returnApproved = (): SectionNode[] => [
    copyBlock([
        heading('Your return is approved'),
        para(
            'Hi {{customer.greeting}} — we’ve approved your return for order {{order.number}}. Here’s what happens next.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Return method', value: 'Ships back for a {{return.outcome}}' },
        ],
        { status: { label: '✓ Approved', role: 'success' } }
    ),
    when('return.hasLabel', [button('Print your return label', '{{return.labelUrl}}', 'center')]),
    copyBlock([
        para('Pack the items securely and send them back — we’ll take it from there once they arrive.'),
    ]),
];

const returnReceived = (): SectionNode[] => [
    copyBlock([
        heading('We’ve received your return'),
        para(
            'Hi {{customer.greeting}} — your return for order {{order.number}} is back with us. Thanks for sending it in.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Next step', value: 'We’re processing your {{return.outcome}}' },
        ],
        { status: { label: 'Received', role: 'info' } }
    ),
    copyBlock([
        button('View your order', '{{return.manageUrl}}', 'center'),
        para('We’ll email you again the moment your {{return.outcome}} is on its way.'),
    ]),
];

const returnRefunded = (): SectionNode[] => [
    copyBlock([
        heading('Your refund is complete'),
        para('Hi {{customer.greeting}} — we’ve refunded your return for order {{order.number}}.'),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Refund amount', value: '{{return.refundAmount}}', emphasize: true },
            { label: 'Refunded to', value: '{{return.refundMethod}}', ref: 'return.refundMethod' },
        ],
        { status: { label: '✓ Refunded', role: 'success' } }
    ),
    copyBlock([
        button('View your order', '{{return.manageUrl}}', 'center'),
        para('Refunds usually take 5–10 business days to appear, depending on your bank.'),
    ]),
];

// ── B2B: order approval outcomes (docs/impl transactional-email §4 P3) ────────
// The buyer's pending order was approved (→ placed) or rejected (→ cancelled) by an
// approver at their organization. Both read the `order` source.

const b2bOrderApproved = (): SectionNode[] => [
    copyBlock([
        heading('Your order is approved'),
        para(
            'Hi {{customer.greeting}} — order {{order.number}} has been approved and is now being processed.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Order total', value: '{{order.total}}', emphasize: true },
        ],
        { status: { label: '✓ Approved', role: 'success' } }
    ),
    copyBlock([button('View your order', '{{order.statusUrl}}', 'center')]),
];

const b2bOrderRejected = (): SectionNode[] => [
    copyBlock([
        heading('Your order wasn’t approved'),
        para(
            'Hi {{customer.greeting}} — order {{order.number}} wasn’t approved, so it hasn’t been placed.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Order', value: '{{order.number}}' },
            { label: 'Order total', value: '{{order.total}}' },
        ],
        { status: { label: 'Not approved', role: 'error' } }
    ),
    copyBlock([
        button('View your order', '{{order.statusUrl}}', 'center'),
        para('Have a question about this decision? Reach out to your account manager any time.'),
    ]),
];

// ── Scheduling: the industry-agnostic `booking` source (docs/79 §10) ─────────
// The legacy B2B-fleet `appointment` source (service_appointments) was retired
// 2026-07-14 (docs/79 §15.7) — B2B fleet bookings are Bookings too.

/**
 * The shared booking body: a short warm lead, then the DETAIL PANEL that carries the
 * what / when / where at a glance (service + time are always shown; duration /
 * location / host drop when a given booking kind — appointment · class · reservation
 * · rental — doesn't carry them), one primary action, a quiet "add to calendar" link
 * beneath it, and a closing reassurance line. The panel is the point: a reader should
 * find the time without reading a sentence.
 */
const bookingBody = (
    title: string,
    lead: string,
    cta: string,
    reassurance: string,
    status: DetailStatus
): SectionNode[] => [
        copyBlock([heading(title), para(lead)]),
        detailPanel(
            [
                { label: 'Service', value: '{{booking.service}}' },
                // The date/time is the one fact the recipient opened the email to check —
                // rendered large + brand-colored so the eye lands on it first.
                { label: 'When', value: '{{booking.when}}', emphasize: true },
                { label: 'Duration', value: '{{booking.duration}}', ref: 'booking.duration' },
                { label: 'Location', value: '{{booking.location}}', ref: 'booking.location' },
                { label: 'With', value: '{{booking.staff}}', ref: 'booking.staff' },
            ],
            { status }
        ),
        copyBlock([button(cta, '{{booking.manageUrl}}', 'center')]),
        when('booking.addToCalendarUrl', [actionLink('Add to calendar', '{{booking.addToCalendarUrl}}')]),
        copyBlock([para(reassurance)]),
    ];

const bookingConfirmation = (): SectionNode[] =>
    bookingBody(
        'Your booking is confirmed',
        'Hi {{customer.greeting}} — you’re all set. Here are the details:',
        'Manage booking',
        'Need to reschedule or cancel? You can manage this booking any time with the button above.',
        { label: '✓ Confirmed', role: 'success' }
    );

const bookingReminder = (): SectionNode[] =>
    bookingBody(
        'A reminder about your upcoming booking',
        'Hi {{customer.greeting}} — a friendly reminder about your upcoming booking:',
        'Manage booking',
        'Need to reschedule or cancel? You can manage this booking any time with the button above.',
        { label: 'Upcoming', role: 'info' }
    );

const bookingRescheduled = (): SectionNode[] =>
    bookingBody(
        'Your booking has been rescheduled',
        'Hi {{customer.greeting}} — your booking has moved. Here are the new details:',
        'Manage booking',
        'Need to make another change? You can manage this booking any time with the button above.',
        { label: 'Rescheduled', role: 'warning' }
    );

const bookingCancelled = (): SectionNode[] => [
    copyBlock([
        heading('Your booking was cancelled'),
        para('Hi {{customer.greeting}} — your booking has been cancelled. Here’s what was cancelled:'),
    ]),
    detailPanel(
        [
            { label: 'Service', value: '{{booking.service}}' },
            { label: 'Was scheduled for', value: '{{booking.when}}', emphasize: true },
            {
                label: 'Reason',
                value: '{{booking.cancellationReason}}',
                ref: 'booking.cancellationReason',
            },
        ],
        { status: { label: 'Cancelled', role: 'error' } }
    ),
    copyBlock([
        button('Book another time', '{{booking.bookUrl}}', 'center'),
        para('We’d love to see you again — book a new time whenever you’re ready.'),
    ]),
];

// Owner-facing counterpart of booking-confirmation (docs/79 §10) — sent to the
// BUSINESS (assigned host, else the site inbox) when someone books online. A
// per-SITE send: identity + brand resolve from the booking's property, never the
// tenant. `booking.newHeadline` reads "New booking request" for a requires-approval
// booking; `booking.pendingApproval` surfaces the action-needed line.
const bookingNotificationInternal = (): SectionNode[] => [
    copyBlock([
        heading('{{booking.newHeadline}}'),
        para('{{customer.displayName}} booked {{booking.service}}.'),
    ]),
    when('booking.pendingApproval', [
        para(
            'This booking is a request awaiting your approval — confirm or decline it from your dashboard.'
        ),
    ]),
    // The booking facts, scannable at a glance — this is an operational alert, so the
    // owner should read the time and where without parsing prose.
    detailPanel(
        [
            { label: 'Service', value: '{{booking.service}}' },
            { label: 'When', value: '{{booking.when}}', emphasize: true },
            { label: 'With', value: '{{booking.staff}}', ref: 'booking.staff' },
            { label: 'Location', value: '{{booking.location}}', ref: 'booking.location' },
            { label: 'Party size', value: '{{booking.partySize}}', ref: 'booking.partySize' },
        ],
        { status: { label: 'New booking', role: 'info' } }
    ),
    // A second card for the customer's contact details, so a callback is one glance away.
    detailPanel([
        // `displayName`, not `fullName ?? "—"`: this row carries no `ref`, so unlike its
        // siblings it cannot hide itself when the value is missing and needed a literal
        // fallback to avoid an empty cell. A never-blank name removes the need, and reads
        // the same as the sentence one card above ("A customer booked …").
        { label: 'Customer', value: '{{customer.displayName}}' },
        { label: 'Email', value: '{{customer.email}}' },
        { label: 'Company', value: '{{customer.company}}', ref: 'customer.company' },
    ]),
    when('booking.addToCalendarUrl', [
        button('Add to calendar', '{{booking.addToCalendarUrl}}', 'center'),
    ]),
];

const waitlistOffer = (): SectionNode[] => [
    copyBlock([
        heading('A spot just opened up'),
        para(
            'Hi {{customer.greeting}} — good news: a spot opened for {{waitlist.service}} in your requested window. Book now to claim it.'
        ),
    ]),
    detailPanel(
        [
            { label: 'Service', value: '{{waitlist.service}}' },
            { label: 'Available window', value: '{{waitlist.window}}', emphasize: true },
            { label: 'Held until', value: '{{waitlist.offerExpires}}', ref: 'waitlist.offerExpires' },
        ],
        { status: { label: 'Spot available', role: 'success' } }
    ),
    copyBlock([
        button('Book your spot', '{{waitlist.bookUrl}}', 'center'),
        para('Spots fill quickly — this one’s held just for you until the time above.'),
    ]),
];

// ── The registry ─────────────────────────────────────────────────────────────

/** Every default's silica body, by template key. Built once at module load (like the
 *  legacy trees) so the authored node id sequence is stable across reads. */
const SILICA_EMAIL_BODIES: Record<string, SectionNode[]> = {
    'welcome-customer': welcomeCustomer(),
    'win-back': winBack(),
    'abandoned-cart': abandonedCart(),
    'post-purchase-review': postPurchaseReview(),
    'chat-satisfaction': chatSatisfaction(),
    'b2b-account-approved': b2bAccountApproved(),
    'b2b-quote-received': b2bQuoteReceived(),
    'b2b-quote-expiring': b2bQuoteExpiring(),
    'b2b-invoice-due': b2bInvoiceDue(),
    'invoicing-reminder': invoicingReminder(),
    'invoicing-overdue': invoicingOverdue(),
    'invoicing-overdue-2': invoicingOverdue2(),
    'invoicing-overdue-final': invoicingOverdueFinal(),
    'invoicing-receipt': invoicingReceipt(),
    'order-confirmation': orderConfirmation(),
    'shipping-confirmation': shippingConfirmation(),
    'order-delivered': orderDelivered(),
    'order-cancelled': orderCancelled(),
    'order-refunded': orderRefunded(),
    'payment-failed': paymentFailed(),
    'subscription-confirmed': subscriptionConfirmed(),
    'subscription-renewed': subscriptionRenewed(),
    'subscription-payment-failed': subscriptionPaymentFailed(),
    'subscription-authentication-required': subscriptionAuthenticationRequired(),
    'subscription-invoice': subscriptionInvoice(),
    'subscription-paused': subscriptionPaused(),
    'subscription-resumed': subscriptionResumed(),
    'subscription-cancelled': subscriptionCancelled(),
    'return-approved': returnApproved(),
    'return-received': returnReceived(),
    'return-refunded': returnRefunded(),
    'b2b-order-approved': b2bOrderApproved(),
    'b2b-order-rejected': b2bOrderRejected(),
    'booking-confirmation': bookingConfirmation(),
    'booking-reminder': bookingReminder(),
    'booking-rescheduled': bookingRescheduled(),
    'booking-cancelled': bookingCancelled(),
    'waitlist-offer': waitlistOffer(),
    'booking-notification-internal': bookingNotificationInternal(),
};

/** The silica document for a default template. Subject + preheader live INSIDE the
 *  document now (silica owns those fields, docs/120 D3), so they're passed in from the
 *  registry entry rather than duplicated here.
 *
 *  THROWS on an unknown key — deliberately. A new default added to
 *  `DEFAULT_EMAIL_TEMPLATES` with no silica body would otherwise provision silently as
 *  a legacy-only email and quietly keep the old engine alive; this fails at module
 *  load, in every test and every boot, instead. */
export function silicaDefaultEmail(
    key: string,
    subject: string,
    preheader: string
): SilicaEmailDocument {
    const body = SILICA_EMAIL_BODIES[key];
    if (!body) {
        throw new Error(
            `default-emails-silica: no silica body authored for template "${key}" — add one to SILICA_EMAIL_BODIES.`
        );
    }
    return emailDoc(subject, preheader, body);
}

export { SILICA_EMAIL_BODIES };
