// The DELIVERY GATE — which `email.send` events the worker will accept.
//
// ══════════════════════════════════════════════════════════════════════════
// A TEMPLATE MISSING FROM HERE IS AN EMAIL NOBODY EVER SEES
// ══════════════════════════════════════════════════════════════════════════
//
// This union does not merely describe the payloads; it decides them. When a
// message does not match, `parseEvent` returns null, `createBrokerHandler` logs
// one warning and ACKS it, and the mail is gone — the publisher saw a success,
// the broker saw a success, and nobody is told.
//
// Four templates lived in exactly that state: `login-otp`, `magic-link`,
// `team-invitation` and `partner-welcome` were registered in `@wizeworks/email`,
// listed in the events union, and published from live auth code — and dropped
// here. Two of them are how a person signs in, so passwordless sign-in could
// not complete and inviting a teammate delivered nothing. Every typecheck, lint
// and test in the repo passed the whole time.
//
// SO THE GATE IS ITS OWN MODULE, imported by `handler.ts` rather than buried in
// it. `handler.ts` pulls in `@wizeworks/email` for `renderTemplate`, which drags the
// React templates along; asking "does the gate cover every template" should not
// require loading a rendering stack. Split out, the coverage test imports only
// zod and a list of strings — which is why that test can exist at all.
//
// Adding a template to `@wizeworks/email` is not finished until its literal is
// here. `__tests__/template-coverage.test.ts` fails the build if it is not.

import { z } from 'zod';

export const Variables = z.record(z.string(), z.string()).optional();

// Fields every template send carries, independent of the template id. Spread
// into each discriminated-union member so they stay in one place.
//   propertyId (docs/49 Phase 7b): the site this send is on behalf of — drives
//   per-site brand resolution in handle(). Absent/null → tenant-wide brand.
export const TemplateMeta = {
  to: z.string().email(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  variables: Variables,
  propertyId: z.string().nullable().optional(),
};

// Back-compat: `storeName` was renamed to `siteName` (store→site rename).
// In-flight Pub/Sub messages published before the rename still carry
// `storeName`; map it to `siteName` before validation so they don't dead-letter.
// Safe to remove once no legacy messages remain in any subscription backlog.
const withLegacySiteName = (v: unknown) => {
  if (v && typeof v === 'object' && !('siteName' in v) && 'storeName' in v) {
    const { storeName, ...rest } = v as Record<string, unknown>;
    return { ...rest, siteName: storeName };
  }
  return v;
};

// ══════════════════════════════════════════════════════════════════════════
// THIS UNION IS A DELIVERY GATE, NOT A TYPE ANNOTATION
// ══════════════════════════════════════════════════════════════════════════
//
// A template missing from here does not fail loudly. `parseEvent` returns null,
// `createBrokerHandler` logs one warning and ACKS, and the email is gone — the
// publisher succeeded, the event was accepted, and nobody is ever told.
//
// Four templates sat in exactly that state: `login-otp`, `magic-link`,
// `team-invitation` and `partner-welcome` were registered in `send.tsx`, listed
// in the events union, and published from live auth code — and dropped here.
// The sign-in code and the sign-in link were among them, so passwordless
// sign-in could not complete at all, and inviting a teammate sent nothing.
//
// So: adding a template to `@wizeworks/email` is not finished until its literal is
// in this union. The full six-point checklist is in the platform-email notes;
// this is the point where forgetting is silent.
export const TemplateSendSchema = z.discriminatedUnion('template', [
  z.object({
    template: z.literal('password-reset'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      resetUrl: z.string().url(),
      expiresInMinutes: z.number().int().positive().optional(),
      intro: z.string().optional(),
      outro: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('welcome-merchant'),
    ...TemplateMeta,
    // A platform signup email — carries NO site/tenant name (docs/49). `siteName` is
    // accepted-but-ignored only so any in-flight legacy message still validates; the
    // template no longer renders it. Drop once no legacy messages remain.
    props: z.object({
      name: z.string().optional(),
      siteName: z.string().optional(),
      dashboardUrl: z.string().url(),
      intro: z.string().optional(),
      outro: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('email-verification'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      verifyUrl: z.string().url(),
      expiresInMinutes: z.number().int().positive().optional(),
      intro: z.string().optional(),
      outro: z.string().optional(),
    }),
  }),
  // The two passwordless sign-in sends. Both are published from better-auth
  // callbacks (`server.ts` sendMagicLink / sendVerificationOTP), and neither
  // has a synchronous fallback — if the event is dropped, the person simply
  // never receives the thing they are waiting on to get in.
  z.object({
    template: z.literal('magic-link'),
    ...TemplateMeta,
    props: z.object({
      magicUrl: z.string().url(),
      expiresInMinutes: z.number().int().positive().optional(),
    }),
  }),
  z.object({
    template: z.literal('login-otp'),
    ...TemplateMeta,
    // Not `.regex(/^\d+$/)`: the code's alphabet belongs to better-auth's OTP
    // config, and a schema that disagreed with it would drop sign-in codes for
    // the length of a config change.
    props: z.object({
      code: z.string().min(1),
      expiresInMinutes: z.number().int().positive().optional(),
    }),
  }),
  z.object({
    template: z.literal('team-invitation'),
    ...TemplateMeta,
    // Published from TWO places with the same shape — api-rest's own invite
    // route and better-auth's `organization.sendInvitationEmail` hook — so this
    // has to match both, not whichever one was read last.
    props: z.object({
      inviteeEmail: z.string().min(1),
      orgName: z.string().min(1),
      inviterName: z.string().min(1),
      role: z.string().min(1),
      acceptUrl: z.string().url(),
      expiresInDays: z.number().int().positive(),
    }),
  }),
  z.object({
    template: z.literal('partner-welcome'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      dashboardUrl: z.string().url(),
      needsPassword: z.boolean().optional(),
    }),
  }),
  z.object({
    template: z.literal('domain-renewal-reminder'),
    ...TemplateMeta,
    props: z.object({
      domainName: z.string().min(1),
      daysUntilExpiry: z.number().int().positive(),
      expiresAt: z.string(),
      renewUrl: z.string().url(),
      autoRenew: z.boolean().optional(),
    }),
  }),
  z.object({
    template: z.literal('chat-notification'),
    ...TemplateMeta,
    props: z.preprocess(
      withLegacySiteName,
      z.object({
        customerName: z.string().min(1),
        messageSnippet: z.string(),
        conversationUrl: z.string().url(),
        siteName: z.string().optional(),
      })
    ),
  }),
  z.object({
    template: z.literal('market-settlement-report'),
    ...TemplateMeta,
    props: z.object({
      merchantName: z.string().min(1),
      periodLabel: z.string().min(1),
      orderCount: z.number().int().nonnegative(),
      currency: z.string().min(1),
      grossCents: z.number().int().nonnegative(),
      commissionCents: z.number().int().nonnegative(),
      commissionRateLabel: z.string(),
      refundCents: z.number().int().nonnegative(),
      netCents: z.number().int(),
      payoutDestination: z.string(),
      pendingBankAccount: z.boolean(),
      settlementUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('feedback-response'),
    ...TemplateMeta,
    props: z.object({
      recipientName: z.string().nullable().optional(),
      feedbackTitle: z.string().min(1),
      responseBody: z.string().min(1),
      responderName: z.string().min(1),
      statusLabel: z.string().optional(),
      threadUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('job-application-received'),
    ...TemplateMeta,
    props: z.object({
      roleTitle: z.string().min(1),
      applicantName: z.string().min(1),
      applicantEmail: z.string().email(),
      phone: z.string().optional(),
      location: z.string().optional(),
      linkedinUrl: z.string().optional(),
      portfolioUrl: z.string().optional(),
      roleInterest: z.string().optional(),
      coverLetter: z.string().optional(),
      resumeUrl: z.string().optional(),
      resumeFilename: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('job-application-confirmation'),
    ...TemplateMeta,
    props: z.object({
      applicantName: z.string().optional(),
      roleTitle: z.string().min(1),
    }),
  }),
  // Site-form emails (docs/115) — the owner notification + the submitter autoresponder.
  // Enqueued by the `form.notify` / `form.autoreply` automation actions
  // (`@wizeworks/automation-actions`) via `enqueueSend`, so they arrive on the async
  // email.send path and MUST be in this union or they'd be acked-and-dropped. The
  // producer builds props from resolved form fields, several of which are legitimately
  // absent — a form whose settings panel was never opened has a null `formName`, and
  // `siteName` is null only if the property vanished — so those are nullable here and the
  // templates render a fallback rather than crash.
  z.object({
    template: z.literal('form-submission-notification'),
    ...TemplateMeta,
    props: z.object({
      siteName: z.string().nullable().optional(),
      formName: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      answers: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      attachmentNames: z.array(z.string()).optional(),
      pageSlug: z.string().nullable().optional(),
      submittedAt: z.string().nullable().optional(),
    }),
  }),
  z.object({
    template: z.literal('form-submission-confirmation'),
    ...TemplateMeta,
    props: z.object({
      siteName: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      subject: z.string().nullable().optional(),
      message: z.string().nullable().optional(),
    }),
  }),
  z.object({
    template: z.literal('gated-delivery'),
    ...TemplateMeta,
    props: z.object({
      siteName: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      subject: z.string().nullable().optional(),
      message: z.string().nullable().optional(),
      filename: z.string().min(1).max(255),
      // The signed link. Minted by api-rest and carried verbatim — the worker
      // never composes it, because the storage key lives inside the signature.
      url: z.string().url(),
      expiresInDays: z.number().int().positive().max(365),
    }),
  }),
  z.object({
    template: z.literal('tool-result'),
    ...TemplateMeta,
    props: z.object({
      toolName: z.string().min(1),
      // Optional: derived from the resolved brand's site URL, which can be unset.
      toolUrl: z.string().url().optional(),
      // Computed label/value pairs only. There is deliberately NO attachment or
      // file field here: several tool pages promise the visitor's own file never
      // leaves their browser, and a schema that cannot express a file is the
      // cheapest way to keep that promise true. Capped so a malformed caller
      // cannot post an unbounded body through the public endpoint.
      lines: z
        .array(z.object({ label: z.string().min(1).max(120), value: z.string().max(4000) }))
        .min(1)
        .max(50),
      note: z.string().max(2000).nullable().optional(),
      // No brandName. The template reads the sending brand from the provider
      // that paints the masthead, so a caller cannot sign the email off as a
      // company other than the one whose wordmark is on it.
    }),
  }),
  z.object({
    template: z.literal('billing-receipt'),
    ...TemplateMeta,
    props: z.object({
      accountName: z.string().optional(),
      amountLabel: z.string().min(1),
      periodLabel: z.string().optional(),
      invoiceUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('billing-payment-failed'),
    ...TemplateMeta,
    props: z.object({
      accountName: z.string().optional(),
      amountLabel: z.string().min(1),
      updateUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('billing-trial-ending'),
    ...TemplateMeta,
    props: z.object({
      accountName: z.string().optional(),
      trialEndLabel: z.string().min(1),
      manageUrl: z.string().url(),
    }),
  }),
  // One email for every subscription state change (started/canceled/plan-changed/
  // paused/resumed), published from the Stripe billing webhook. `kind` drives the copy;
  // every other field is an optional label the template renders when present.
  z.object({
    template: z.literal('subscription-update'),
    ...TemplateMeta,
    props: z.object({
      kind: z.enum(['started', 'canceled', 'plan-changed', 'paused', 'resumed']),
      accountName: z.string().optional(),
      planLabel: z.string().optional(),
      amountLabel: z.string().optional(),
      trialEndLabel: z.string().optional(),
      renewsOnLabel: z.string().optional(),
      effectiveLabel: z.string().optional(),
      manageUrl: z.string().url(),
    }),
  }),
  // Domain lifecycle (published from domain-worker + the email-domains verify route).
  z.object({
    template: z.literal('domain-live'),
    ...TemplateMeta,
    props: z.object({
      domainName: z.string().min(1),
      siteUrl: z.string().optional(),
      dashboardUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('domain-expired'),
    ...TemplateMeta,
    props: z.object({
      domainName: z.string().min(1),
      expiredOnLabel: z.string().optional(),
      renewUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('email-domain-verified'),
    ...TemplateMeta,
    props: z.object({
      domainName: z.string().min(1),
      dashboardUrl: z.string().url(),
    }),
  }),
  // Tenant→customer document signing request. `signingUrl` may be a bare PATH when
  // SPARX_SITE_BASE is unset (signature-mail.ts) — so it is NOT `.url()`.
  z.object({
    template: z.literal('document-signature-request'),
    ...TemplateMeta,
    props: z.object({
      signerName: z.string().optional(),
      documentLabel: z.string().min(1),
      documentNumber: z.string(),
      documentTotal: z.number(),
      currency: z.string().min(1),
      expiresAt: z.string(),
      signingUrl: z.string().min(1),
    }),
  }),
  // Tenant -> customer invoice. The document travels IN the mail (there is no
  // public invoice page), so the lines and the summary rows come with it.
  // `dueAt` is nullable on purpose: a business that agreed no terms has no due
  // date, and inventing one would put a deadline on the customer that nobody set.
  z.object({
    template: z.literal('invoice-sent'),
    ...TemplateMeta,
    props: z.object({
      billToName: z.string().optional(),
      fromName: z.string().min(1),
      documentLabel: z.string().min(1),
      documentNumber: z.string().min(1),
      total: z.number(),
      balance: z.number(),
      currency: z.string().min(1),
      dueAt: z.string().nullable().optional(),
      lines: z.array(
        z.object({
          title: z.string(),
          subtitle: z.string().optional(),
          amount: z.string(),
        })
      ),
      summary: z.array(z.object({ label: z.string(), value: z.string() })),
      note: z.string().nullable().optional(),
    }),
  }),
  // Team / org membership.
  z.object({
    template: z.literal('invitation-accepted'),
    ...TemplateMeta,
    props: z.object({
      inviterName: z.string().optional(),
      inviteeName: z.string().optional(),
      inviteeEmail: z.string(),
      orgName: z.string().min(1),
      dashboardUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('team-member-removed'),
    ...TemplateMeta,
    props: z.object({
      memberName: z.string().optional(),
      orgName: z.string().min(1),
    }),
  }),
  z.object({
    template: z.literal('team-role-changed'),
    ...TemplateMeta,
    props: z.object({
      memberName: z.string().optional(),
      orgName: z.string().min(1),
      newRole: z.string().min(1),
      dashboardUrl: z.string().url(),
    }),
  }),
  // A module was turned on/off.
  z.object({
    template: z.literal('module-toggle'),
    ...TemplateMeta,
    props: z.object({
      enabled: z.boolean(),
      accountName: z.string().optional(),
      moduleName: z.string().min(1),
      dashboardUrl: z.string().url(),
    }),
  }),
  // Partner program.
  z.object({
    template: z.literal('partner-application-received'),
    ...TemplateMeta,
    props: z.object({
      applicantName: z.string().min(1),
      applicantEmail: z.string(),
      requestedTier: z.string().optional(),
      websiteUrl: z.string().optional(),
      kind: z.string().optional(),
      reviewUrl: z.string().url(),
    }),
  }),
  z.object({
    template: z.literal('partner-earnings'),
    ...TemplateMeta,
    props: z.object({
      kind: z.enum(['referral', 'commission', 'payout']),
      partnerName: z.string().optional(),
      amountLabel: z.string().optional(),
      dashboardUrl: z.string().url(),
    }),
  }),
  // Account security.
  z.object({
    template: z.literal('password-changed'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      changedAtLabel: z.string().optional(),
      secureUrl: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('two-factor-changed'),
    ...TemplateMeta,
    props: z.object({
      enabled: z.boolean(),
      name: z.string().optional(),
      secureUrl: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('new-device-signin'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      location: z.string().optional(),
      ipAddress: z.string().optional(),
      device: z.string().optional(),
      signedInAtLabel: z.string().optional(),
      secureUrl: z.string().optional(),
    }),
  }),
  // "We got your feedback" ack.
  z.object({
    template: z.literal('feedback-received'),
    ...TemplateMeta,
    props: z.object({
      recipientName: z.string().nullable().optional(),
      feedbackTitle: z.string().min(1),
    }),
  }),
  // The social module's two "something needs you" emails. A post that failed and an
  // account that stopped working are the only two things in that module a person must
  // be TOLD about rather than discover (docs/social-audit GAPs 1 + 2).
  z.object({
    template: z.literal('social-post-failed'),
    ...TemplateMeta,
    props: z.object({
      excerpt: z.string().min(1),
      failed: z.array(z.object({ name: z.string().min(1), reason: z.string().optional() })).min(1),
      succeeded: z.array(z.string()).optional(),
      postUrl: z.string().url(),
      scheduledFor: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('social-connection-expired'),
    ...TemplateMeta,
    props: z.object({
      platformName: z.string().min(1),
      accountName: z.string().optional(),
      scheduledCount: z.number().int().nonnegative().optional(),
      reconnectUrl: z.string().url(),
    }),
  }),
  // A scheduled inventory report (docs/146 Phase 10.4). `lines` carries the
  // headline figures already formatted by the report, and `isGap` marks the ones
  // that report something the platform could NOT measure — the template sets
  // those apart rather than listing them among the statistics.
  z.object({
    template: z.literal('inventory-report'),
    ...TemplateMeta,
    props: z.object({
      businessName: z.string().min(1),
      scheduleName: z.string().min(1),
      reportLabel: z.string().min(1),
      reportDescription: z.string().optional(),
      periodLabel: z.string().optional(),
      lines: z
        .array(
          z.object({
            label: z.string().min(1),
            value: z.string(),
            isGap: z.boolean().optional(),
          })
        )
        .min(1),
      rowCount: z.number().int().nonnegative().nullable().optional(),
      attachmentName: z.string().nullable().optional(),
      attachmentTooLarge: z.boolean().optional(),
      // `.min(1)` not `.url()` — this can be a bare path, and a url() here would
      // fail the gate silently and drop the send.
      reportUrl: z.string().min(1),
    }),
  }),
]);
