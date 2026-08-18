// The engagement spine — write shapes for what was SAID (docs/144 §5).
//
// Four things a person does from a record: send an email, log a call, write a
// note, and reuse something they have written before. They share one set of
// schemas because they share one table and one timeline — a note that cannot be
// replied to is still a thing that was said, and splitting them would mean the
// timeline had to merge three shapes at read time.

import { z } from 'zod';

import { Uuid } from './common';

/** email | call | note | meeting — what KIND of thing was said. */
export const EngagementKind = z.enum(['email', 'call', 'note', 'meeting']);
export type EngagementKind = z.infer<typeof EngagementKind>;

/** How a call ended. Only meaningful on a call. */
export const CallOutcome = z.enum(['connected', 'no_answer', 'voicemail', 'busy', 'wrong_number']);
export type CallOutcome = z.infer<typeof CallOutcome>;

const EmailAddress = z.string().trim().toLowerCase().email().max(320);

/* ── Mailboxes ──────────────────────────────────────────────────────────── */

/**
 * How sparx connects to a mailbox: over IMAP and SMTP, and only that.
 *
 * NOT the Gmail API and NOT Microsoft Graph, deliberately. Reading mail through
 * those needs Google's restricted-scope CASA assessment and Microsoft's
 * publisher verification — a recurring third-party security audit as the price
 * of a mailbox connector, and a vendor with a veto over a feature customers
 * have already paid for. IMAP reaches the same mailboxes (Gmail and Microsoft
 * 365 both speak it), over an app password the tenant issues and revokes in
 * their own account settings, which puts them rather than us in the consent
 * loop.
 */
export const MailboxProvider = z.enum(['imap_smtp']);
export type MailboxProvider = z.infer<typeof MailboxProvider>;

/**
 * personal — one staff user's mailbox. shared — a team address.
 *
 * This is a PRIVACY BOUNDARY, not a preference: a personal mailbox holds that
 * person's private mail, so the inbound sync gate is far stricter for one than
 * for the other (see `syncGateFor` below).
 */
export const MailboxScope = z.enum(['personal', 'shared']);
export type MailboxScope = z.infer<typeof MailboxScope>;

/** A hostname, not a URL and not an address with a port glued on. Validated
 *  because a typo here surfaces as a confusing connection timeout minutes later
 *  rather than as "check the server name" while the person is still looking at
 *  the form. */
const Hostname = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(255)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, {
    message: 'Enter a server name like imap.example.com — no https:// and no port.',
  });

export const ConnectMailboxInput = z
  .object({
    provider: MailboxProvider.default('imap_smtp'),
    scope: MailboxScope.default('personal'),
    emailAddress: EmailAddress,
    displayName: z.string().max(255).nullable().optional(),
    /** Whose mailbox. Required for a personal one — see the refine below. */
    userId: Uuid.nullable().optional(),
    propertyId: Uuid.nullable().optional(),
    imapHost: Hostname,
    /** 993 is implicit TLS and the only inbound port sparx will use. Port 143
     *  is plaintext-then-maybe-upgrade, which is downgrade-attackable, and a
     *  mail password is not a credential to negotiate over. */
    imapPort: z.number().int().min(1).max(65_535).default(993),
    smtpHost: Hostname,
    /** 465 (implicit TLS) or 587 (STARTTLS, verified before any credential is
     *  sent). Both are encrypted before authentication; 25 is not offered. */
    smtpPort: z.number().int().min(1).max(65_535).default(587),
    /** Defaults to the email address, which is what it is on nearly every
     *  provider. */
    imapUser: z.string().max(320).optional(),
    /**
     * An APP PASSWORD, not the account password.
     *
     * Every provider worth connecting to issues per-application passwords that
     * are scoped to mail and revocable on their own — and where two-factor
     * authentication is on, an account password will not authenticate an IMAP
     * session anyway. Plaintext on the way IN only: encrypted before it is
     * stored and never returned by any read.
     */
    appPassword: z.string().min(1).max(512),
  })
  .refine((input) => input.scope !== 'personal' || Boolean(input.userId), {
    message: 'A personal mailbox has to belong to someone on your team.',
    path: ['userId'],
  });
export type ConnectMailboxInput = z.infer<typeof ConnectMailboxInput>;

/**
 * WHICH INBOUND MESSAGES A CONNECTION IS ALLOWED TO STORE (docs/144 §5.3).
 *
 * A connected PERSONAL mailbox syncs only messages whose counterpart address is
 * already a known contact. Everything else is discarded unread — never stored,
 * never indexed, never searchable. Someone's doctor's appointment and their
 * mortgage broker do not belong in a CRM, and "we only show you the relevant
 * ones" is not the same promise as "we only keep the relevant ones".
 *
 * A SHARED address (sales@, support@) is different in kind: it exists to receive
 * mail from strangers, and a first email from a new prospect is exactly what it
 * is for. So it keeps everything, and that is what the connect flow says.
 */
export function syncGateFor(scope: MailboxScope): 'known_contacts_only' | 'everything' {
  return scope === 'personal' ? 'known_contacts_only' : 'everything';
}

/* ── Sending, logging, noting ───────────────────────────────────────────── */

export const SendEmailInput = z.object({
  /** The person it is to. Their address is read from the record, so a typo
   *  cannot send a customer's mail to the wrong place. */
  customerId: Uuid,
  /** What it is about, when it is about something. */
  dealId: Uuid.nullable().optional(),
  ticketId: Uuid.nullable().optional(),
  /** Continue an existing conversation rather than starting one. */
  threadId: Uuid.nullable().optional(),
  subject: z.string().min(1).max(998),
  bodyHtml: z.string().min(1).max(500_000),
  cc: z.array(EmailAddress).max(20).optional(),
  /** Send through a connected mailbox so it lands in that person's Sent folder
   *  and reads as coming from them. Omitted = the tenant's sending domain. */
  mailboxConnectionId: Uuid.nullable().optional(),
  /** Bumps the template's send counter, which is how a business finds out which
   *  of their templates actually gets replies. */
  templateId: Uuid.nullable().optional(),
});
export type SendEmailInput = z.infer<typeof SendEmailInput>;

export const LogCallInput = z.object({
  customerId: Uuid,
  dealId: Uuid.nullable().optional(),
  ticketId: Uuid.nullable().optional(),
  direction: z.enum(['in', 'out']),
  outcome: CallOutcome,
  durationSec: z.number().int().min(0).max(86_400).optional(),
  /** What was said. The whole reason for logging it. */
  notes: z.string().max(20_000).optional(),
  /** When it happened, if not now — people log calls after the fact. */
  occurredAt: z.string().datetime().optional(),
});
export type LogCallInput = z.infer<typeof LogCallInput>;

export const LogNoteInput = z.object({
  customerId: Uuid,
  dealId: Uuid.nullable().optional(),
  ticketId: Uuid.nullable().optional(),
  body: z.string().min(1).max(20_000),
  occurredAt: z.string().datetime().optional(),
});
export type LogNoteInput = z.infer<typeof LogNoteInput>;

/**
 * An inbound message, as the mail sync hands it over.
 *
 * Deliberately permissive about addresses: real mail arrives with malformed
 * headers, and refusing to record a reply because its Reply-To is unparseable
 * would lose the reply rather than the header.
 */
export const InboundMessageInput = z.object({
  mailboxConnectionId: Uuid,
  rfcMessageId: z.string().max(998),
  inReplyTo: z.string().max(998).nullable().optional(),
  references: z.string().max(20_000).nullable().optional(),
  providerThreadId: z.string().max(255).nullable().optional(),
  subject: z.string().max(998).nullable().optional(),
  fromAddress: z.string().max(320),
  toAddresses: z.array(z.string().max(320)).max(100).optional(),
  ccAddresses: z.array(z.string().max(320)).max(100).optional(),
  bodyHtml: z.string().max(2_000_000).nullable().optional(),
  bodyText: z.string().max(2_000_000).nullable().optional(),
  sentAt: z.string().datetime(),
});
export type InboundMessageInput = z.infer<typeof InboundMessageInput>;

/* ── Templates and snippets ─────────────────────────────────────────────── */

export const CreateTemplateInput = z.object({
  name: z.string().min(1).max(255),
  folder: z.string().max(120).nullable().optional(),
  subject: z.string().min(1).max(998),
  bodyHtml: z.string().min(1).max(500_000),
  /** Private by default — a half-written draft should not appear in a
   *  colleague's picker. */
  isShared: z.boolean().optional(),
  propertyId: Uuid.nullable().optional(),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateInput>;

// Safe to `.partial()`: nothing here carries a `.default()`, so an omitted key
// stays omitted rather than being fabricated. (The trap that rule avoids is
// documented at length on UpdateDealInput.)
export const UpdateTemplateInput = CreateTemplateInput.partial();
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateInput>;

export const CreateSnippetInput = z.object({
  /** What you type to get it. Stored without the leading `;` so a tenant who
   *  types one and a tenant who does not both reach the same snippet. */
  shortcut: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .transform((value) => value.replace(/^[;:/]/, ''))
    .pipe(z.string().regex(/^[a-z0-9_-]+$/i, 'Use letters, numbers, - and _ only.')),
  name: z.string().min(1).max(255),
  body: z.string().min(1).max(20_000),
  isShared: z.boolean().optional(),
});
export type CreateSnippetInput = z.infer<typeof CreateSnippetInput>;

export const UpdateSnippetInput = z.object({
  name: z.string().min(1).max(255).optional(),
  body: z.string().min(1).max(20_000).optional(),
  isShared: z.boolean().optional(),
});
export type UpdateSnippetInput = z.infer<typeof UpdateSnippetInput>;
