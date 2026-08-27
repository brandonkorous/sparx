'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE LEGAL-PAGES DATA LAYER
//
// The Legal surface is a CHECKLIST over a fixed set of policy documents a
// business is expected to publish — privacy, terms, cookies, and (with commerce
// on) returns/shipping/refund. A legal page is not a bespoke thing: it is an
// ordinary CMS `page` content entry with a `legalKind` set. So this module owns
// three concerns and hands the fourth away:
//
//   • the checklist        — GET /v1/legal/checklist   (present / missing / …)
//   • instantiate a page   — POST /v1/legal/pages       (from a starter template)
//   • acknowledge starter  — POST /v1/legal/pages/:id/acknowledge
//   • footer placements    — GET/POST/PATCH/DELETE /v1/legal/placements
//
// EDITING THE ACTUAL TEXT is deliberately NOT here. Because a legal page is a
// ContentEntry, "Edit text" opens the existing content editor
// (`cms.content.detail`) — there is exactly one editor for prose in the app, and
// this surface never rebuilds it.
//
// api-rest hands these routes back in camelCase (the handlers build the objects
// by hand, unlike the snake_case `serializeEntry` used by the content routes),
// so the wire names are kept verbatim. Shared helpers — the status → words/tone
// mapping, the server-error sentence, date formatting — are imported from the
// content data layer rather than re-spelled, so the two can never drift.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { contentKeys, LEGAL_QUERY_ROOT, type EntryStatus, type Tone } from './data';
import { productCopy } from '../../lib/product';

/* ── Shapes (camelCase, exactly as wizeworks/services/api-rest/src/routes/v1/legal.ts
 *    serialises them) ──────────────────────────────────────────────────────*/

/** Where a checklist item sits, as the server computes it. Kept for callers that
 *  want the raw server verdict; the surface renders from `legalItemStatus`
 *  below, which folds in the acknowledgement + template-version facts too. */
export type ChecklistState = 'complete' | 'missing' | 'draft' | 'stale' | 'unplaced';

/** The content entry backing a legal page, in the trimmed shape the checklist
 *  returns (NOT the full content entry — that is fetched by the editor). */
export interface ChecklistEntry {
  id: string;
  slug: string | null;
  status: EntryStatus;
  updatedAt: string;
  /** The starter-template version this page was built from, or null if unknown. */
  templateVersion: number | null;
  /** The latest available starter version — `templateVersion < currentVersion`
   *  is a "newer wording available" hint. */
  currentVersion: number;
  /** Has someone confirmed they read + tailored the starter wording? */
  acknowledged: boolean;
  /** Is it linked in the site footer? */
  placed: boolean;
}

/** One row of the checklist — one policy document the business may need. */
export interface ChecklistItem {
  legalKind: string;
  /** The document's proper name, e.g. "Privacy Policy". */
  title: string;
  defaultSlug: string;
  /** Required for THIS business (always-required, plus commerce ones when the
   *  commerce module is on). Non-required rows are genuinely optional. */
  required: boolean;
  state: ChecklistState;
  /** null when the page has not been created yet. */
  entry: ChecklistEntry | null;
}

/** Why we think this business posts things to people. Evidence, never a default
 *  — see the note on ShippingEvidence in @wizeworks/cms. */
export type ShippingEvidence = 'delivery-rates' | 'orders-shipped';

export interface ShippingPolicySignal {
  ships: boolean;
  because: ShippingEvidence | null;
  missingPolicy: boolean;
}

export interface LegalChecklist {
  items: ChecklistItem[];
  completeness: { requiredTotal: number; requiredComplete: number };
  /** Absent on an older server; treat that as "no reason to ask". */
  shipping?: ShippingPolicySignal;
}

/** One footer link to a legal (or other) page. `propertyId === null` means the
 *  link shows on every site under this business; otherwise it is scoped to the
 *  one active site. */
export interface LegalPlacement {
  id: string;
  label: string | null;
  legalKind: string | null;
  columnKey: string | null;
  position: number;
  enabled: boolean;
  entryId: string | null;
  propertyId: string | null;
  slug: string | null;
  status: EntryStatus | null;
}

/* ── The query-key tree ─────────────────────────────────────────────────── */

export const legalKeys = {
  all: LEGAL_QUERY_ROOT,
  checklist: () => [...legalKeys.all, 'checklist'] as const,
  placements: () => [...legalKeys.all, 'placements'] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useLegalChecklist() {
  return useQuery({
    queryKey: legalKeys.checklist(),
    queryFn: () => api.get<LegalChecklist>('/v1/legal/checklist'),
  });
}

export function useLegalPlacements() {
  return useQuery({
    queryKey: legalKeys.placements(),
    queryFn: () => api.get<LegalPlacement[]>('/v1/legal/placements'),
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** Every write here can move BOTH the checklist (a state or a "placed" flag) and
 *  the placements list, so refreshing one without the other would leave the two
 *  disagreeing on screen. They are refreshed together, always. */
function useInvalidateLegal() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: legalKeys.checklist() });
    void queryClient.invalidateQueries({ queryKey: legalKeys.placements() });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** Instantiate a starter template into a private draft page (the server also
 *  wires it into the footer). Returns just the id — the editor fetches the rest. */
export function useInstantiateLegalPage() {
  const invalidate = useInvalidateLegal();
  return useMutation({
    mutationFn: (legalKind: string) => api.post<{ id: string }>('/v1/legal/pages', { legalKind }),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Mark a page's starter wording as reviewed — clears the "needs review" note.
 *  Idempotent server-side: acknowledging an already-acknowledged page is a no-op. */
export function useAcknowledgeLegalPage() {
  const invalidate = useInvalidateLegal();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string; acknowledgedAt: string | null }>(`/v1/legal/pages/${id}/acknowledge`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/**
 * Take the current starter wording for a legal page.
 *
 * The page's existing body is banked as a revision server-side before it is
 * replaced, and the "I have read this" acknowledgement is cleared — the words
 * are different now, so the old acceptance certifies text nobody has read.
 */
export function useTakeStarterWording() {
  const invalidate = useInvalidateLegal();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ id: string }>(`/v1/legal/pages/${id}/starter`),
    onSuccess: (_result, id) => {
      invalidate();
      // The PAGE itself changed, not just its row on this checklist. An editor
      // open on it in another pane is holding the old wording, and its Save would
      // put that back over the new one — so the entry and its revision list are
      // refreshed too, and content-detail re-reads whenever its draft is clean.
      void queryClient.invalidateQueries({ queryKey: contentKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: contentKeys.revisions(id) });
      void queryClient.invalidateQueries({ queryKey: contentKeys.lists() });
    },
  });
}

export interface AddPlacementInput {
  entryId: string;
  label?: string;
  /** true = this site only; false/omitted = every site under this business. */
  siteScoped?: boolean;
}

export function useAddPlacement() {
  const invalidate = useInvalidateLegal();
  return useMutation({
    mutationFn: (input: AddPlacementInput) =>
      api.post<LegalPlacement>('/v1/legal/placements', input),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSetPlacementEnabled() {
  const invalidate = useInvalidateLegal();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch<LegalPlacement>(`/v1/legal/placements/${id}`, { enabled }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useRemovePlacement() {
  const invalidate = useInvalidateLegal();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/legal/placements/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Saying what a document IS and where it stands ──────────────────────── */

/** What each kind of document DOES, in the words an owner would use — never the
 *  legal name of the concept. Keyed by `legalKind`; an unknown kind falls
 *  through to a safe generic line rather than showing nothing. */
export function legalKindBlurb(legalKind: string): string {
  switch (legalKind) {
    case 'privacy':
      return 'Tells visitors what personal information you collect about them and how you use it.';
    case 'terms':
      return 'The rules people agree to by using your site or buying from you.';
    case 'cookie-policy':
      return 'Explains the cookies your site uses and the choices visitors have about them.';
    case 'returns':
      return 'How customers can send an item back to you.';
    case 'shipping':
      return 'How and when you send orders out, and what it costs.';
    case 'refund':
      return 'When and how you give a customer their money back.';
    default:
      return 'A policy page for your site.';
  }
}

/** What the document is CALLED, for a sentence that names it — "your Privacy
 *  Policy is live". Lower-cased at the call site where the grammar wants it. */
export function legalKindTitle(legalKind: string): string {
  switch (legalKind) {
    case 'privacy':
      return 'Privacy Policy';
    case 'terms':
      return 'Terms of Service';
    case 'cookie-policy':
      return 'Cookie Policy';
    case 'returns':
      return 'Return Policy';
    case 'shipping':
      return 'Shipping Policy';
    case 'refund':
      return 'Refund Policy';
    default:
      return 'policy page';
  }
}

export interface LegalStatus {
  label: string;
  tone: Tone;
  detail: string;
  /** True when there is an outstanding review action — unreviewed starter
   *  wording, or a newer starter version to fold in. */
  needsReview: boolean;
  /** True specifically when a newer starter version exists. */
  stale: boolean;
}

/**
 * Where a checklist row stands, as a single badge plus a plain-language sentence.
 *
 * One badge, four states — Missing, Needs review, Draft, Published — because a
 * checklist's whole job is "what still needs me?", and the answer has to be one
 * word, not two competing ones. "Needs review" deliberately outranks the
 * lifecycle: a page that is live but built on outdated starter wording is a
 * problem to fix, not a box already ticked. The fact that it is currently live
 * is carried in the sentence rather than a second badge.
 */
export function legalItemStatus(item: ChecklistItem): LegalStatus {
  const entry = item.entry;
  if (!entry) {
    return {
      label: 'Missing',
      tone: 'warning',
      detail: 'You have not added this page yet.',
      needsReview: false,
      stale: false,
    };
  }

  const stale = entry.templateVersion !== null && entry.templateVersion < entry.currentVersion;
  const needsReview = !entry.acknowledged || stale;

  if (needsReview) {
    const live = entry.status === 'published';
    return {
      label: 'Needs review',
      tone: 'warning',
      detail: stale
        ? // Says what is true and what she can DO about it. It used to read "open it
          // to see what changed and update it" — and the editor it opened offered
          // neither, because nothing in the product ever wrote
          // `legal_template_version` after creation. A stale page could not be made
          // current by any means. The action beside this row is what makes the
          // sentence keepable.
          `The starter wording has been updated since this page was made.${live ? ' Your live page still shows the older version.' : ''} You can take the new wording — what is on the page now is kept in its history.`
        : productCopy(
            'cms.legal.unreviewed',
            'This still uses the Piggles starter wording. Read it through, make it fit your business, then mark it reviewed.'
          ),
      needsReview: true,
      stale,
    };
  }

  if (entry.status === 'published') {
    return {
      label: 'Published',
      tone: 'success',
      detail: 'Live on your site — anyone can read it.',
      needsReview: false,
      stale: false,
    };
  }

  if (entry.status === 'archived') {
    return {
      label: 'Draft',
      tone: 'info',
      detail: 'Taken down and kept as a draft. Publish it again to put it back on your site.',
      needsReview: false,
      stale: false,
    };
  }

  return {
    label: 'Draft',
    tone: 'info',
    detail:
      entry.status === 'scheduled'
        ? 'Set to go live at a scheduled time. Until then it stays a private draft.'
        : 'Saved but not on your site yet. Publish it when you are ready.',
    needsReview: false,
    stale: false,
  };
}
