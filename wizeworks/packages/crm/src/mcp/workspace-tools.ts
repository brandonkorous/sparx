// MCP tools for the CRM workspace layer (docs/144 §11 + §12).
//
// Everything here is about how a business WORKS its CRM rather than about a
// customer — which makes the confirmation gates unusually easy to reason about:
//
//   · Reads are open, including the domain match. Asking "which company owns
//     this address" changes nothing; the answer is a suggestion.
//   · Saved views and meeting links are ungated writes. The worst outcome of
//     getting one wrong is a list somebody re-sorts.
//   · Settings ARE gated, because one of them is the switch that lets the
//     platform merge records without a person looking.
//   · Bulk merge is gated and takes an explicit confidence floor with no
//     default. It is the single most destructive operation in the CRM, and an
//     assistant that can invoke it by omission is one that will.
//
// There is deliberately NO tool that signs a document. A signature is a person
// agreeing to something; an assistant that could produce one on a customer's
// behalf would make every signature in the system worth less. Requesting one is
// fine — that is asking, which is what a rep does anyway.

import { z } from 'zod';

import {
  companyService,
  crmSettingsService,
  meetingLinkService,
  mergeService,
  savedViewService,
  signatureService,
} from '../services';

import type { McpToolDefinition } from './registry';

/* ── Companies: the domain match ─────────────────────────────────────────── */

export const matchCompanyByEmail: McpToolDefinition = {
  name: 'match_company_by_email',
  description:
    'Which company an email address belongs to, worked out from its domain. Returns the company, or nothing plus the reason — the address is a personal one (gmail, outlook and the like), no company claims that domain, or the business has this turned off. This is a SUGGESTION: it never links anybody to anything. Use it before creating a contact so you can ask "should this person go under Acme?" rather than guessing.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    email: z.string().email(),
    propertyId: z.string().uuid().nullable().optional(),
  }),
  run: (ctx, input) => {
    const { email, propertyId } = input as { email: string; propertyId?: string | null };
    return companyService.matchByEmailDomain(ctx, email, propertyId ?? null);
  },
};

/* ── Settings ────────────────────────────────────────────────────────────── */

export const getCrmSettings: McpToolDefinition = {
  name: 'get_crm_settings',
  description:
    'How this business has told the CRM to behave: whether it offers a company when a new contact’s email domain matches one, what counts as the same person when looking for duplicates, and whether duplicates may ever be merged automatically. Read this before doing anything with duplicates — the answer changes what "duplicate" means here.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ propertyId: z.string().uuid().nullable().optional() }),
  run: (ctx, input) =>
    crmSettingsService.crmSettings(
      ctx,
      (input as { propertyId?: string | null }).propertyId ?? null
    ),
};

export const updateCrmSettings: McpToolDefinition = {
  name: 'update_crm_settings',
  description:
    'Change how the CRM behaves. `domainAssociation` turns the company suggestion on or off. `duplicateMatchRules` picks which signals mean the same person — email, phone, or last name plus employer. `autoMergeThreshold` is how sure the platform must be before merging two records WITHOUT anybody looking; leave it null to always require a person, which is the safe answer and the default. Merging cannot be undone.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    domainAssociation: z.boolean().optional(),
    duplicateMatchRules: z
      .array(z.enum(['email', 'phone', 'name_company']))
      .min(1)
      .optional(),
    autoMergeThreshold: z.number().int().min(50).max(100).nullable().optional(),
    propertyId: z.string().uuid().nullable().optional(),
  }),
  run: (ctx, input) => {
    const { propertyId, ...patch } = input as { propertyId?: string | null } & Record<
      string,
      unknown
    >;
    return crmSettingsService.update(ctx, patch, propertyId ?? null);
  },
};

/* ── Duplicates ──────────────────────────────────────────────────────────── */

export const findDuplicates: McpToolDefinition = {
  name: 'find_crm_duplicates',
  description:
    'Groups of contact records that look like the same person, most certain first. Each group says WHY it was grouped and how sure that is out of 100 — an identical email is certain, a shared phone number is likely, and a matching last name and employer is a guess that could easily be two colleagues. Report the confidence when you report the group; a business deciding whether to merge needs it.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({
    limit: z.number().int().min(10).max(10_000).optional(),
    propertyId: z.string().uuid().nullable().optional(),
  }),
  run: (ctx, input) =>
    mergeService.findLikelyDuplicates(ctx, input as { limit?: number; propertyId?: string | null }),
};

export const bulkMergeDuplicates: McpToolDefinition = {
  name: 'bulk_merge_crm_duplicates',
  description:
    'Merge every duplicate group the platform is at least `minConfidence` sure about. THIS CANNOT BE UNDONE. The most recently updated record in each group survives and absorbs the others — their orders, spend, deals, tasks and addresses move onto it, and any field the survivor was missing is filled in from the ones being merged. Say `minConfidence: 100` to touch only groups matched on an identical email address; lower numbers reach guesses. Always show the person what `find_crm_duplicates` returned before calling this.',
  scope: 'write:crm_bulk',
  confirmation: true,
  input: z.object({
    minConfidence: z.number().int().min(50).max(100),
    limit: z.number().int().min(10).max(10_000).optional(),
    propertyId: z.string().uuid().nullable().optional(),
  }),
  run: (ctx, input) =>
    mergeService.bulkMerge(
      ctx,
      input as { minConfidence: number; limit?: number; propertyId?: string | null }
    ),
};

/* ── Saved views ─────────────────────────────────────────────────────────── */

export const listSavedViews: McpToolDefinition = {
  name: 'list_crm_saved_views',
  description:
    'The saved ways of looking at a list — "my open deals", "requests waiting on us" — both this person’s own and any the team has shared. Each carries the filter, the columns and the order it uses.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ objectKey: z.string().max(63).optional() }),
  run: (ctx, input) => savedViewService.list(ctx, input as { objectKey?: string }),
};

export const createSavedView: McpToolDefinition = {
  name: 'create_crm_saved_view',
  description:
    'Save a way of looking at a list: which records (a filter, in the same shape automation conditions use), which columns, and what to sort by. Leave `columns` empty to keep whatever the list shows by default. `isShared` makes it visible to the whole team but still editable only by whoever made it.',
  scope: 'write:crm',
  confirmation: false,
  input: z.object({
    objectKey: z.string().min(1).max(63),
    name: z.string().min(1).max(120),
    filters: z.record(z.string(), z.unknown()).optional(),
    columns: z.array(z.string()).max(40).optional(),
    sort: z
      .object({ field: z.string(), direction: z.enum(['asc', 'desc']) })
      .nullable()
      .optional(),
    isShared: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }),
  run: (ctx, input) => savedViewService.create(ctx, input),
};

export const deleteSavedView: McpToolDefinition = {
  name: 'delete_crm_saved_view',
  description:
    'Delete a saved view. Only the person who made it can — a shared view somebody else built is not yours to remove.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({ viewId: z.string().uuid() }),
  run: async (ctx, input) => {
    await savedViewService.remove(ctx, (input as { viewId: string }).viewId);
    return { deleted: true };
  },
};

/* ── Meeting links ───────────────────────────────────────────────────────── */

export const listMeetingLinks: McpToolDefinition = {
  name: 'list_crm_meeting_links',
  description:
    'The team’s personal booking links — the ones a rep puts in an email so a customer can pick a time. Each says whose it is, what gets booked, and how many times it has been used.',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ userId: z.string().uuid().optional() }),
  run: (ctx, input) => meetingLinkService.list(ctx, input as { userId?: string }),
};

export const createMeetingLink: McpToolDefinition = {
  name: 'create_crm_meeting_link',
  description:
    'Create a personal booking link at /meet/<slug>. It points at one bookable service, which is where the length, the availability and the cancellation rules all come from — this only adds the memorable address and whose calendar it fills. Use `list_scheduling_services` to find the service first; a service that is not offered for online booking will be refused, because a link to it would not work.',
  scope: 'write:crm',
  confirmation: false,
  input: z.object({
    serviceId: z.string().uuid(),
    slug: z.string().min(2).max(63),
    name: z.string().min(1).max(120),
    description: z.string().max(2000).nullable().optional(),
    userId: z.string().uuid().optional(),
  }),
  run: (ctx, input) => meetingLinkService.create(ctx, input),
};

/* ── E-sign ──────────────────────────────────────────────────────────────── */

export const requestSignature: McpToolDefinition = {
  name: 'request_document_signature',
  description:
    'Ask a customer to sign an estimate, quote or work order. Returns a one-time signing link — it is shown ONCE and cannot be looked up again, so give it to the person now. Asking a second time for the same document replaces the first link rather than adding one, so only ever one is live. When they sign, the document is frozen exactly as they saw it and moves to the approved stage on its own.',
  scope: 'write:crm',
  confirmation: true,
  input: z.object({
    documentId: z.string().uuid(),
    signerName: z.string().min(1).max(160),
    signerEmail: z.string().email(),
    expiresInDays: z.number().int().min(1).max(90).optional(),
    notify: z.boolean().optional(),
  }),
  run: async (ctx, input) => {
    const { documentId, ...body } = input as { documentId: string } & Record<string, unknown>;
    const { signature, token, notify } = await signatureService.request(ctx, documentId, body);
    return { signature, token, emailed: notify };
  },
};

export const listSignatures: McpToolDefinition = {
  name: 'list_document_signatures',
  description:
    'Where a document is up to: who was asked to sign, whether they opened it, whether they signed or said no and why, and when the link runs out. This is how you answer "did they ever get back to us about that quote".',
  scope: 'read:crm',
  confirmation: false,
  input: z.object({ documentId: z.string().uuid() }),
  run: (ctx, input) =>
    signatureService.listForDocument(ctx, (input as { documentId: string }).documentId),
};

export const WORKSPACE_TOOLS: McpToolDefinition[] = [
  matchCompanyByEmail,
  getCrmSettings,
  updateCrmSettings,
  findDuplicates,
  bulkMergeDuplicates,
  listSavedViews,
  createSavedView,
  deleteSavedView,
  listMeetingLinks,
  createMeetingLink,
  requestSignature,
  listSignatures,
];
