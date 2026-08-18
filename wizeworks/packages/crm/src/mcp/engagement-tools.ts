// MCP tools for the engagement spine (docs/144 §5).
//
// These are the tools that let an assistant take part in the relationship rather
// than only describe it: read what has actually been said to a customer, send a
// reply, log the call that just happened.
//
// EVERY WRITE HERE IS CONFIRMATION-GATED, and `send_crm_email` most of all: it
// is the only tool in the CRM that puts words in front of a customer under the
// business's name. A wrong product description can be edited; a sent email
// cannot be unsent.

import { z } from 'zod';

import { LogCallInput, LogNoteInput, SendEmailInput } from '@wizeworks/crm-schemas';

import { engagementService, mailboxService, salesTemplateService } from '../services';

import type { McpToolDefinition } from './registry';

/* ── Reads ──────────────────────────────────────────────────────────────── */

export const listConversations: McpToolDefinition = {
  name: 'list_crm_conversations',
  description:
    'Read what has actually been said with a customer — the emails both ways, the calls logged, the notes written — newest conversation first. This is the history a person has with the business, as opposed to what the system did to their orders. Call it before drafting anything so a reply follows what was already discussed rather than starting over.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    customerId: z.string().uuid().optional(),
    dealId: z.string().uuid().optional(),
    ticketId: z.string().uuid().optional(),
    take: z.number().int().min(1).max(50).optional(),
  }),
  run: (ctx, input) =>
    engagementService.listThreads(
      ctx,
      input as { customerId?: string; dealId?: string; ticketId?: string; take?: number }
    ),
};

export const listTemplates: McpToolDefinition = {
  name: 'list_crm_email_templates',
  description:
    'List the reusable emails this business has written, with how often each is sent, opened and replied to. Use it to reuse the wording a business already trusts instead of inventing new copy in their name — and to tell someone which of their templates actually gets answered.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ folder: z.string().optional() }),
  run: (ctx, input) => salesTemplateService.listTemplates(ctx, input as { folder?: string }),
};

export const listMailboxes: McpToolDefinition = {
  name: 'list_crm_mailboxes',
  description:
    "List the mailboxes connected to this business, and whether each is one person's or a shared team address. Sending from a connected mailbox makes the email land in that person's Sent folder and read as coming from them.",
  scope: 'read:crm',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => mailboxService.list(ctx),
};

/* ── Writes ─────────────────────────────────────────────────────────────── */

export const sendCrmEmail: McpToolDefinition = {
  name: 'send_crm_email',
  description:
    "Send an email to one customer from their record, and file it on their timeline. The address is taken from the customer record, so it cannot be sent to the wrong person. THIS PUTS WORDS IN FRONT OF A REAL CUSTOMER UNDER THE BUSINESS'S NAME — show the person the exact subject and body and get their agreement before calling it. Refused for anyone who has asked not to be contacted.",
  scope: 'write:crm',
  confirmation: true,
  input: SendEmailInput,
  run: (ctx, input) => engagementService.sendEmail(ctx, input),
};

export const logCrmCall: McpToolDefinition = {
  name: 'log_crm_call',
  description:
    "Record a phone call on a customer's timeline — which way it went, how it ended, how long it lasted, and what was said. A call nobody answered is worth logging too: it is what tells the next person that three attempts have already been made.",
  scope: 'write:crm',
  confirmation: true,
  input: LogCallInput,
  run: (ctx, input) => engagementService.logCall(ctx, input),
};

export const logCrmNote: McpToolDefinition = {
  name: 'log_crm_note',
  description:
    'Write a note on a customer, a deal or a request — something worth remembering that nobody emailed or phoned about. It goes on the same timeline as everything else, so the next person to open the record sees it.',
  scope: 'write:crm',
  confirmation: true,
  input: LogNoteInput,
  run: (ctx, input) => engagementService.logNote(ctx, input),
};

export const createEmailTemplate: McpToolDefinition = {
  name: 'create_crm_email_template',
  description:
    'Save an email as a reusable template so it can be sent again without rewriting it. Private to whoever creates it unless shared. Sends, opens and replies are counted from then on, which is how a business finds out which of its messages work.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    name: z.string().min(1).max(255),
    folder: z.string().max(120).optional(),
    subject: z.string().min(1).max(998),
    bodyHtml: z.string().min(1),
    isShared: z.boolean().optional(),
  }),
  run: (ctx, input) => salesTemplateService.createTemplate(ctx, input),
};

export const ENGAGEMENT_TOOLS: McpToolDefinition[] = [
  listConversations,
  listTemplates,
  listMailboxes,
  sendCrmEmail,
  logCrmCall,
  logCrmNote,
  createEmailTemplate,
];
