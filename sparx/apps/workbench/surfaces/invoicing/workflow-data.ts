'use client';

// Workflow data — the document lifecycles a tenant configures, and the draft
// shape the editor edits.
//
// This file OWNS the `['invoicing', 'workflows']` query keys and the draft
// types; the two workflow surfaces read from here rather than each fetching its
// own way. `DocumentWorkflowDetail` / `DocumentStage` themselves live in
// ./types.ts, which is the single wire-shape definition the whole module shares.
//
// The draft is deliberately NOT the wire shape. Two differences carry weight:
//
//   • `sortOrder` is absent. Order is the array's order, full stop. A stage list
//     that carries both an array position and a sortOrder field has two answers
//     to "what comes third" and no rule for which wins — reorder bugs live in
//     exactly that gap. It is re-derived from the index at save.
//   • a stage has BOTH `id` and `key`. `id` is the server's, null until a stage
//     has been saved once, and it is what the save diff reconciles against.
//     `key` is a session-local React key, which a brand-new stage needs before
//     it has any id at all — using the index instead would make React reuse the
//     wrong row's open/editing state the moment two stages swap places.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import { slugify as slugifyWebSegment } from '../../lib/slugify';
import type { DocumentStageType, DocumentWorkflowDetail } from './types';

export const WORKFLOWS_KEY = ['invoicing', 'workflows'];

/** One stage as the editor holds it, before it is anything the server knows. */
export interface StageDraft {
  /** The server's id, or null for a stage added in this session. */
  id: string | null;
  /** Session-local React key. Never sent, never persisted. */
  key: string;
  name: string;
  customerLabel: string;
  stageType: DocumentStageType;
  snapshotOnEnter: boolean;
  numberOnEnter: boolean;
  /** Held as a string because it is an <Input>; '' means "no prefix" and is
   *  collapsed to null at save (the API rejects an empty string). */
  numberPrefix: string;
  locksEditing: boolean;
}

export interface WorkflowDraft {
  name: string;
  slug: string;
  isDefault: boolean;
  stages: StageDraft[];
}

/** A fresh session key. Random rather than a counter: a counter resets on HMR
 *  and re-mints keys that are still mounted, which is how React starts reusing
 *  the wrong row. */
export function newStageKey(): string {
  return `stage-${crypto.randomUUID()}`;
}

/** Slug from a name, for the create path — the operator never types one. */
export function slugify(name: string): string {
  return slugifyWebSegment(name.trim(), 63);
}

export function toStageDraft(stage: DocumentWorkflowDetail['stages'][number]): StageDraft {
  return {
    id: stage.id,
    key: newStageKey(),
    name: stage.name,
    customerLabel: stage.customerLabel,
    stageType: stage.stageType,
    snapshotOnEnter: stage.snapshotOnEnter,
    numberOnEnter: stage.numberOnEnter,
    numberPrefix: stage.numberPrefix ?? '',
    locksEditing: stage.locksEditing,
  };
}

export function toWorkflowDraft(workflow: DocumentWorkflowDetail): WorkflowDraft {
  return {
    name: workflow.name,
    slug: workflow.slug,
    isDefault: workflow.isDefault,
    stages: workflow.stages.map(toStageDraft),
  };
}

/**
 * The stage a brand-new workflow starts with.
 *
 * One stage, not zero and not a canned five-stage template. Zero would mean the
 * first thing the editor shows is an empty list with nothing explaining what a
 * stage is; a canned template would mean everyone's workflows quietly become
 * the same shape whether or not it fits how they actually bill. One stage that
 * already numbers documents is the smallest thing that is genuinely a working
 * workflow — a document can enter it and come out with an invoice number.
 */
export function starterStage(): StageDraft {
  return {
    id: null,
    key: newStageKey(),
    name: 'Invoice',
    customerLabel: 'Invoice',
    stageType: 'open',
    snapshotOnEnter: false,
    numberOnEnter: true,
    numberPrefix: 'INV-',
    locksEditing: false,
  };
}

export function emptyWorkflowDraft(): WorkflowDraft {
  return { name: '', slug: '', isDefault: false, stages: [starterStage()] };
}

/** A stage added part-way through an existing workflow. Deliberately inert —
 *  no entry effects — so adding one can never silently start locking or
 *  numbering documents before anyone has looked at it. */
export function blankStage(): StageDraft {
  return {
    id: null,
    key: newStageKey(),
    name: '',
    customerLabel: '',
    stageType: 'draft',
    snapshotOnEnter: false,
    numberOnEnter: false,
    numberPrefix: '',
    locksEditing: false,
  };
}

/* ── Queries ─────────────────────────────────────────────────────────────── */

/** Sortable columns — EXACTLY the server's whitelist (see the `sort_by` enum in
 *  wizeworks/services/api-rest/src/routes/v1/invoicing/workflows.ts). A key that is not in
 *  both places is a header that 400s. */
export type WorkflowSortKey = 'name' | 'slug' | 'stages' | 'state' | 'updatedAt' | 'createdAt';

export type WorkflowState = 'active' | 'archived' | 'all';

export interface WorkflowListArgs {
  q?: string;
  state?: WorkflowState;
  sortBy?: WorkflowSortKey;
  order?: 'asc' | 'desc';
  take?: number;
  skip?: number;
}

/**
 * A window of workflows, sorted and counted by the server.
 *
 * Both of those are server-side because nothing bounds how many workflows a
 * tenant has — a single-brand shop has three, and a manufacturer running a
 * different flow per product line or dealer tier has hundreds. Sorting what
 * happens to be loaded would quietly mean "sort this page", which is a
 * different answer from the one a column header promises.
 */
export function useWorkflows(args: WorkflowListArgs = {}) {
  const { q, state, sortBy, order, take, skip } = args;
  return useQuery({
    queryKey: [
      ...WORKFLOWS_KEY,
      {
        q: q ?? '',
        state: state ?? 'active',
        sortBy: sortBy ?? '',
        order: order ?? '',
        take,
        skip,
      },
    ],
    queryFn: () =>
      api.list<DocumentWorkflowDetail>('/v1/invoicing/workflows', {
        ...(q ? { q } : {}),
        ...(state ? { state } : {}),
        ...(sortBy ? { sort_by: sortBy, order: order ?? 'asc' } : {}),
        ...(take !== undefined ? { take } : {}),
        ...(skip !== undefined ? { skip } : {}),
      }),
    // Keeps the previous window on screen while the next loads, so paging and
    // re-sorting don't blink the table out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: [...WORKFLOWS_KEY, id],
    queryFn: () => api.get<DocumentWorkflowDetail>(`/v1/invoicing/workflows/${id}`),
    enabled: id !== 'new',
  });
}

/** Invalidates everything a workflow change can move. Broad on purpose: a
 *  document's header renders its stage's label, so a rename over here changes
 *  what an open invoice pane is displaying. */
export function useInvalidateWorkflows() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
  };
}

export function useArchiveWorkflow() {
  const invalidate = useInvalidateWorkflows();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/invoicing/workflows/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/**
 * The server's own sentence for a 4xx, shown verbatim. These routes explain the
 * thing this screen cannot infer — that a slug is taken, or that a stage still
 * has documents sitting on it — far better than a status code can.
 */
export function workflowErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
