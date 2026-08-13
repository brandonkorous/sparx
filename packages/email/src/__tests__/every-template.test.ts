// Every coded template, actually rendered.
//
// `templates.test.ts` has a case named "wraps every coded template in the shared
// frame" that renders exactly ONE template and infers the rest. Seven of the twenty
// were covered that way; the other thirteen had never been rendered by any test at
// all — so a template that threw, leaked an `undefined` into a sentence, or shipped a
// raw `{{token}}` would have been found by the customer receiving it.
//
// The point here is BREADTH, not depth: per-template assertions stay in
// `templates.test.ts`, which is the place to pin a specific string. This asserts what
// must hold for ALL of them. `CASES` is typed `Record<TemplateId, …>`, so adding a
// template to the union without adding it here fails to compile rather than shipping
// untested.

import { describe, expect, it } from 'vitest';

import {
  _renderTemplateForTest,
  _setEmailProvider,
  consoleProvider,
  resetConsoleProvider,
} from '..';
import type { TemplateId, TemplateSend } from '../send';

resetConsoleProvider();
_setEmailProvider(consoleProvider);

/** Each template's OWN props type, pulled off the `TemplateSend` union by its id.
 *
 *  Typing this `Record<TemplateId, Record<string, unknown>>` was the first attempt and
 *  it was worse than useless: it let a case pass `{ platform }` where the template
 *  reads `{ name }`, and an object where it reads a string. That rendered a literal
 *  `[object Object]` into the email — which the assertions below duly caught, as a
 *  failure in the TEST rather than in the template it was accusing. Keyed off the real
 *  union, wrong props now fail to compile. */
type PropsFor<K extends TemplateId> = Extract<TemplateSend, { template: K }>['props'];

/** Realistic props per template — real-looking URLs, names and money, because a
 *  placeholder like `x` hides exactly the formatting bugs this exists to catch. */
const CASES: { [K in TemplateId]: PropsFor<K> } = {
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

const IDS = Object.keys(CASES) as TemplateId[];

describe('every coded template renders', () => {
  it.each(IDS)('%s', async (template) => {
    const out = await _renderTemplateForTest({
      template,
      to: 'someone@example.test',
      props: CASES[template],
    } as Parameters<typeof _renderTemplateForTest>[0]);

    expect(out.subject.trim(), 'subject').not.toBe('');
    expect(out.html.length, 'html').toBeGreaterThan(200);
    expect(out.text.trim(), 'text').not.toBe('');
    expect(out.templateId).toBe(template);

    // Nothing half-rendered may reach an inbox. `undefined` / `NaN` / `[object Object]`
    // are what a missing or mis-shaped prop looks like once it is inside a sentence,
    // and `{{` is a merge token nothing resolved.
    for (const body of [out.html, out.text]) {
      expect(body, 'raw merge token').not.toContain('{{');
      expect(body, 'undefined leaked').not.toMatch(/\bundefined\b/);
      expect(body, 'NaN leaked').not.toMatch(/\bNaN\b/);
      expect(body, 'object leaked').not.toContain('[object Object]');
    }
    expect(out.subject).not.toMatch(/\bundefined\b|\bNaN\b|\{\{/);

    // The shared frame is what makes it a sparx email rather than loose HTML.
    expect(out.html, 'shared frame').toContain('sparx.works');
  });

  it('has a case for every TemplateId', () => {
    // The `Record<TemplateId, …>` type catches a NEW id at compile time. This catches
    // the other direction — an id removed from the union but left behind here — and
    // pins the count so a silent drop is visible.
    expect(new Set(IDS).size).toBe(IDS.length);
    expect(IDS.length).toBe(36);
  });
});
