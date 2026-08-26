// One realistic set of props per template — the fixtures BOTH ends of the email
// pipeline are proven against.
//
// ══════════════════════════════════════════════════════════════════════════
// WHY THIS SHIPS IN `src/` RATHER THAN LIVING IN A TEST FILE
// ══════════════════════════════════════════════════════════════════════════
//
// A template send crosses two independent checks that can disagree: the
// worker's zod gate decides whether the message is ACCEPTED, and this package's
// renderer decides whether it RENDERS. They are maintained by hand in different
// repos-within-the-repo, and a mismatch fails the way this system always fails
// — `parseEvent` returns null, the broker acks, and the mail is gone.
//
// Name coverage alone does not catch that. A gate whose `acceptUrl` is
// `.url()` while the publisher sends a path, or that requires a field the
// template treats as optional, passes every "is the template listed" check and
// still drops the email. Only parsing a REAL payload catches it.
//
// So the fixtures live here, importable by both sides, and both assert against
// the same objects: `@wizeworks/email` renders them, `@wizeworks/email-worker` parses
// them. If the two ever disagree about a template's shape, one of those suites
// goes red instead of a customer not receiving something.
//
// `Record<TemplateId, Record<string, unknown>>` was the first shape of this and
// it was worse than useless — it let a case pass `{ platform }` where the
// template reads `{ name }`, rendering a literal `[object Object]`. Keyed off
// the real union, wrong props now fail to COMPILE.
//
// Keep them realistic: real-looking URLs, names and money. A placeholder like
// `x` hides exactly the formatting bugs these exist to catch.

import type { TemplateId, TemplateSend } from './send';

/** Each template's OWN props type, pulled off the `TemplateSend` union by its id.
 *
 *  Typing this `Record<TemplateId, Record<string, unknown>>` was the first attempt and
 *  it was worse than useless: it let a case pass `{ platform }` where the template
 *  reads `{ name }`, and an object where it reads a string. That rendered a literal
 *  `[object Object]` into the email — which the assertions below duly caught, as a
 *  failure in the TEST rather than in the template it was accusing. Keyed off the real
 *  union, wrong props now fail to compile. */
export type PropsFor<K extends TemplateId> = Extract<TemplateSend, { template: K }>['props'];

/** Realistic props per template — real-looking URLs, names and money, because a
 *  placeholder like `x` hides exactly the formatting bugs this exists to catch. */
export const TEMPLATE_PROPS: { [K in TemplateId]: PropsFor<K> } = {
  'password-reset': {
    name: 'Rosa',
    resetUrl: 'https://app.sparx.works/reset?token=t',
    expiresInMinutes: 30,
  },
  'welcome-merchant': { name: 'Rosa', dashboardUrl: 'https://app.sparx.works/welcome' },
  'partner-welcome': {
    name: 'Rosa',
    dashboardUrl: 'https://app.sparx.works/partners',
    needsPassword: true,
  },
  'email-verification': {
    name: 'Rosa',
    verifyUrl: 'https://app.sparx.works/verify?token=t',
    expiresInMinutes: 60,
  },
  'magic-link': { magicUrl: 'https://app.sparx.works/magic?token=t', expiresInMinutes: 15 },
  'login-otp': { code: '481920', expiresInMinutes: 10 },
  'domain-renewal-reminder': {
    domainName: 'rosasflowers.com',
    daysUntilExpiry: 14,
    expiresAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    renewUrl: 'https://app.sparx.works/domains',
    autoRenew: false,
  },
  'chat-notification': {
    customerName: 'Dev Patel',
    messageSnippet: 'Do you deliver on Saturdays?',
    conversationUrl: 'https://app.sparx.works/inbox/1',
    siteName: 'Rosa Flowers',
  },
  'market-settlement-report': {
    merchantName: 'Rosa Flowers',
    periodLabel: 'July 2026',
    orderCount: 42,
    currency: 'USD',
    grossCents: 128_400,
    commissionCents: 6_420,
    commissionRateLabel: '5%',
    refundCents: 2_500,
    netCents: 119_480,
    payoutDestination: 'Chase 1234',
    pendingBankAccount: false,
    settlementUrl: 'https://app.sparx.works/finance/settlements/1',
  },
  'feedback-response': {
    recipientName: 'Dev Patel',
    feedbackTitle: 'Add Saturday delivery',
    responseBody: 'We just turned this on for your area.',
    responderName: 'Rosa',
    statusLabel: 'Shipped',
    threadUrl: 'https://app.sparx.works/feedback/1',
  },
  'job-application-received': {
    roleTitle: 'Founding Engineer',
    applicantName: 'Dev Patel',
    applicantEmail: 'dev@example.test',
    phone: '+1 555 0100',
    location: 'Remote',
    linkedinUrl: 'https://linkedin.test/in/dev',
    portfolioUrl: 'https://dev.example.test',
    roleInterest: 'Building the platform',
    coverLetter: 'I have shipped commerce systems for eight years.',
    resumeUrl: 'https://files.example.test/r.pdf',
    resumeFilename: 'dev-patel.pdf',
  },
  'job-application-confirmation': { applicantName: 'Dev Patel', roleTitle: 'Founding Engineer' },
  'team-invitation': {
    inviteeEmail: 'dev@example.test',
    orgName: 'Rosa Flowers',
    inviterName: 'Rosa',
    role: 'editor',
    acceptUrl: 'https://app.sparx.works/accept-invite?token=t',
    expiresInDays: 7,
  },
  'form-submission-notification': {
    siteName: 'Rosa Flowers',
    formName: 'Contact',
    email: 'dev@example.test',
    name: 'Dev Patel',
    answers: [{ label: 'Message', value: 'Do you deliver on Saturdays?' }],
    attachmentNames: ['brief.pdf'],
    pageSlug: 'contact',
    submittedAt: new Date('2026-08-06T10:00:00Z').toISOString(),
  },
  'form-submission-confirmation': {
    siteName: 'Rosa Flowers',
    name: 'Dev Patel',
    subject: 'Thanks for getting in touch',
    message: 'Do you deliver on Saturdays?',
  },
  'tool-result': {
    toolName: 'Margin calculator',
    toolUrl: 'https://sparx.works/tools/margin-calculator',
    // Computed values only — never a file the visitor supplied (see the template).
    lines: [
      { label: 'Cost', value: '$18.40' },
      { label: 'Price', value: '$44.00' },
      { label: 'Margin', value: '58.2%' },
      { label: 'Profit per unit', value: '$25.60' },
    ],
    note: 'Prices exclude tax and shipping.',
    brandName: 'sparx',
  },
  'billing-receipt': {
    accountName: 'Rosa Flowers',
    amountLabel: '$49.00',
    periodLabel: 'Aug 2026',
    invoiceUrl: 'https://app.sparx.works/billing/invoices/1',
  },
  'billing-payment-failed': {
    accountName: 'Rosa Flowers',
    amountLabel: '$49.00',
    updateUrl: 'https://app.sparx.works/billing',
  },
  'billing-trial-ending': {
    accountName: 'Rosa Flowers',
    trialEndLabel: 'August 20, 2026',
    manageUrl: 'https://app.sparx.works/billing',
  },
  'subscription-update': {
    kind: 'plan-changed',
    accountName: 'Rosa Flowers',
    planLabel: 'Growth plan',
    amountLabel: '$49.00 / month',
    renewsOnLabel: 'September 1, 2026',
    effectiveLabel: 'August 10, 2026',
    manageUrl: 'https://app.sparx.works/billing',
  },
  'domain-live': {
    domainName: 'rosasflowers.com',
    siteUrl: 'https://rosasflowers.com',
    dashboardUrl: 'https://app.sparx.works/domains',
  },
  'domain-expired': {
    domainName: 'rosasflowers.com',
    expiredOnLabel: 'August 9, 2026',
    renewUrl: 'https://app.sparx.works/domains',
  },
  'email-domain-verified': {
    domainName: 'mail.rosasflowers.com',
    dashboardUrl: 'https://app.sparx.works/email/settings',
  },
  'document-signature-request': {
    signerName: 'Dev Patel',
    documentLabel: 'Estimate',
    documentNumber: 'EST-1042',
    documentTotal: 1499,
    currency: 'USD',
    expiresAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    signingUrl: 'https://rosasflowers.com/sign/abc',
  },
  'invoice-sent': {
    billToName: 'Ferrous Coffee Bar',
    fromName: 'Rosa Flowers',
    documentLabel: 'Invoice',
    documentNumber: 'INV-000148',
    total: 624,
    balance: 424,
    currency: 'USD',
    dueAt: new Date('2026-09-04T00:00:00Z').toISOString(),
    lines: [
      { title: 'Country sourdough, whole loaf', subtitle: '48 × $8.50', amount: '$408.00' },
      { title: 'Seeded rye', subtitle: '24 × $9.00', amount: '$216.00' },
    ],
    summary: [
      { label: 'Subtotal', value: '$624.00' },
      { label: 'Already paid', value: '-$200.00' },
    ],
    note: 'August standing order: four weeks. 12 sourdough, 6 rye, each week.',
  },
  'invitation-accepted': {
    inviterName: 'Rosa',
    inviteeName: 'Dev Patel',
    inviteeEmail: 'dev@example.test',
    orgName: 'Rosa Flowers',
    dashboardUrl: 'https://app.sparx.works/team',
  },
  'team-member-removed': {
    memberName: 'Dev Patel',
    orgName: 'Rosa Flowers',
  },
  'team-role-changed': {
    memberName: 'Dev Patel',
    orgName: 'Rosa Flowers',
    newRole: 'admin',
    dashboardUrl: 'https://app.sparx.works/team',
  },
  'module-toggle': {
    enabled: true,
    accountName: 'Rosa Flowers',
    moduleName: 'Commerce',
    dashboardUrl: 'https://app.sparx.works/settings/modules',
  },
  'partner-application-received': {
    applicantName: 'Dev Patel',
    applicantEmail: 'dev@example.test',
    requestedTier: 'Certified',
    websiteUrl: 'https://dev.example.test',
    kind: 'Agency',
    reviewUrl: 'https://admin.sparx.works/partners/applications/1',
  },
  'partner-earnings': {
    kind: 'commission',
    partnerName: 'Rosa',
    amountLabel: '$120.00',
    dashboardUrl: 'https://app.sparx.works/partners',
  },
  'password-changed': {
    name: 'Rosa',
    changedAtLabel: 'August 10, 2026 at 9:41 AM',
    secureUrl: 'https://app.sparx.works/security',
  },
  'two-factor-changed': {
    enabled: true,
    name: 'Rosa',
    secureUrl: 'https://app.sparx.works/security',
  },
  'new-device-signin': {
    name: 'Rosa',
    location: 'San Diego, CA',
    ipAddress: '203.0.113.9',
    device: 'Chrome on macOS',
    signedInAtLabel: 'August 10, 2026 at 9:41 AM',
    secureUrl: 'https://app.sparx.works/security',
  },
  'feedback-received': {
    recipientName: 'Dev Patel',
    feedbackTitle: 'Add Saturday delivery windows to bookings',
  },
  'social-post-failed': {
    excerpt: 'Saturday deliveries are here.',
    failed: [{ name: 'Instagram', reason: 'Token expired' }],
    succeeded: ['Facebook'],
    postUrl: 'https://app.sparx.works/social/posts/1',
    scheduledFor: 'August 6, 2026 at 10:00am',
  },
  'social-connection-expired': {
    platformName: 'Instagram',
    accountName: 'rosasflowers',
    scheduledCount: 3,
    reconnectUrl: 'https://app.sparx.works/social/connections',
  },
  'inventory-report': {
    businessName: 'Rosa Flowers',
    scheduleName: 'Monday morning stock check',
    reportLabel: 'Stock that is not paying its rent',
    reportDescription: 'Dead, overstocked and slow lines, with what each costs you to keep.',
    periodLabel: '1 – 31 March 2027',
    lines: [
      { label: 'Lines not paying their rent', value: '42' },
      { label: 'Cash trapped in excess', value: '$18,204.00' },
      { label: 'Lines with no cost price', value: '6', isGap: true },
    ],
    rowCount: 42,
    attachmentName: 'dead-stock.csv',
    reportUrl: 'https://app.sparx.works/inventory/reports',
  },
};
