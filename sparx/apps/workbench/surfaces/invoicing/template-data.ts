'use client';

// Print templates — the letterhead a customer's copy is printed on.
//
// This file OWNS the `['invoicing', 'templates']` query keys and the draft shape
// the editor edits; the two template surfaces read from here rather than each
// fetching its own way, the same arrangement ./workflow-data.ts holds for
// workflows.
//
// Two things about the lifecycle that the shape has to carry:
//
//   • a template has a DRAFT and a PUBLISHED copy. The draft is what the editor
//     saves on every Save; publishing snapshots it. Until a template is both
//     published AND the default for its business, customers keep getting the
//     built-in layout — so "saved" and "in force" are different states and the
//     screen has to be able to say which one a template is in.
//   • a template belongs to ONE business, or to every one. `propertyId` null is
//     the shared tier, and it is a real answer rather than a missing value.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { DEFAULT_INVOICE_TEMPLATE } from '@wizeworks/crm-schemas/builtins';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import { blocksToTree, treeRoot, treeToBlocks, type TemplateBlock } from './template-blocks';

export const TEMPLATES_KEY = ['invoicing', 'templates'];

/** One template as the server holds it. Mirrors `BillingTemplateDto` in
 *  @wizeworks/crm's billing-template-service. */
export interface BillingTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  /** The business this letterhead belongs to, or null for every business. */
  propertyId: string | null;
  /** That business's name, so a list can say which one without a second read. */
  propertyName: string | null;
  tree: unknown;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The template as the editor holds it. The tree becomes a flat block list here
 *  and only here — see ./template-blocks.ts for why. */
export interface TemplateDraft {
  name: string;
  /** null = every business. */
  propertyId: string | null;
  blocks: TemplateBlock[];
}

export function toTemplateDraft(template: BillingTemplate): TemplateDraft {
  return {
    name: template.name,
    propertyId: template.propertyId,
    blocks: treeToBlocks(template.tree),
  };
}

/**
 * What a brand-new template starts as: a copy of the built-in layout.
 *
 * NOT an empty page. The screen says "this one starts as a copy of the standard
 * layout, so you can change the parts you care about" — and it started with
 * nothing on it, under that sentence. A person who pressed Create there got a
 * blank bill. [[feedback_a_promise_in_copy_is_a_contract]]
 *
 * The same tree the server would have defaulted to if the console sent none, so
 * the two agree; building it here is what lets her SEE and rearrange it before
 * pressing Create rather than after.
 *
 * `propertyId` is the business being worked in when there is more than one — a
 * letterhead carries a business's name, so it belongs to one by default rather
 * than to all of them. [[feedback_site_is_the_business]]
 */
export function emptyTemplateDraft(propertyId: string | null = null): TemplateDraft {
  return {
    name: '',
    propertyId,
    blocks: treeToBlocks(DEFAULT_INVOICE_TEMPLATE.tree),
  };
}

/**
 * The draft reduced to what a SAVE would actually change.
 *
 * The block list carries a session key per block for React's benefit, and it is
 * not part of the template. Comparing the raw draft would count a re-read as an
 * edit, so the editor's "unsaved changes" comparison runs through here — BOTH
 * sides of it. Seeding the baseline with a plain `JSON.stringify` instead put a
 * different shape in the ref, the first comparison differed, and the pane was
 * dirty before anyone touched it. The visible damage was not the badge: the
 * adopt effect is guarded on dirty, so a pane that starts dirty never adopts,
 * and opening a saved template showed a blank editor.
 */
export function comparableDraft(value: TemplateDraft): string {
  return JSON.stringify({
    name: value.name,
    propertyId: value.propertyId,
    blocks: value.blocks.map(({ key: _key, ...rest }) => rest),
  });
}

/** The draft back into the tree the server stores, keeping the original root's
 *  own id and class rather than minting a new one each save. */
export function draftTree(draft: TemplateDraft, original: BillingTemplate | null): unknown {
  return blocksToTree(treeRoot(original?.tree), draft.blocks);
}

/* ── Queries ─────────────────────────────────────────────────────────────── */

export interface TemplateListArgs {
  q?: string;
  /** A business id, or 'all' for every business. Absent means the one being
   *  worked in — the house `?property=` rule, resolveListScope in api-rest. */
  property?: string;
  take?: number;
  skip?: number;
}

/**
 * The letterheads available here.
 *
 * The FIRST call on an account with none seeds the built-in default, which is
 * why this endpoint is a GET that writes: a tenant should never open this screen
 * and be told to create something before they can see what their invoices
 * already look like.
 */
export function useTemplates(args: TemplateListArgs = {}) {
  const { q, property, take, skip } = args;
  return useQuery({
    queryKey: [...TEMPLATES_KEY, { q: q ?? '', property: property ?? '', take, skip }],
    queryFn: () =>
      api.list<BillingTemplate>('/v1/invoicing/templates', {
        ...(q ? { q } : {}),
        ...(property ? { property } : {}),
        ...(take !== undefined ? { take } : {}),
        ...(skip !== undefined ? { skip } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, id],
    queryFn: () => api.get<BillingTemplate>(`/v1/invoicing/templates/${id}`),
    enabled: id !== 'new',
  });
}

/** Invalidates everything a template change can move. Broad on purpose: which
 *  template is in force changes what the invoice preview next door draws. */
export function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
  };
}

/* ── Writes ──────────────────────────────────────────────────────────────── */

export interface SaveTemplateArgs {
  id: string;
  draft: TemplateDraft;
  original: BillingTemplate | null;
}

/** Create or save, whichever this is. One call either way, so the editor does
 *  not branch on it. */
export function saveTemplate({ id, draft, original }: SaveTemplateArgs): Promise<BillingTemplate> {
  const body = {
    name: draft.name.trim(),
    propertyId: draft.propertyId,
    tree: draftTree(draft, original),
  };
  return id === 'new'
    ? api.post<BillingTemplate>('/v1/invoicing/templates', body)
    : api.patch<BillingTemplate>(`/v1/invoicing/templates/${id}`, body);
}

export function usePublishTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (id: string) => api.post<BillingTemplate>(`/v1/invoicing/templates/${id}/publish`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useMakeDefaultTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (id: string) => api.post<BillingTemplate>(`/v1/invoicing/templates/${id}/default`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useDeleteTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/invoicing/templates/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** The server's own sentence for a 4xx, shown verbatim. These routes explain
 *  what this screen cannot infer — that the default cannot be deleted, for
 *  instance — better than a status code can. */
export function templateErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
