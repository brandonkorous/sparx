// Saving a workflow — one Save button over four endpoints.
//
// A workflow and its stages are SEPARATE writes, the same way a document and its
// lines are (see ./save.ts). POST/PATCH /v1/invoicing/workflows takes only the
// header — name, slug, isDefault, sortOrder; stages move exclusively through
// POST/PATCH/DELETE /v1/invoicing/workflows/:id/stages[/:stageId] and
// POST …/stages/reorder.
//
// So a save is: write the header, then reconcile the stage list against what the
// server last told us it had. That reconciliation is why the editor keeps the
// loaded workflow around as `original` — without it there is no way to know a
// stage was DELETED, only that it is no longer on screen.
//
// The editor is explicit-save, last-write-wins, like every other editor on the
// platform. That is what makes a diff the right unit of work here rather than a
// PATCH per keystroke: reordering three stages and renaming one is ONE
// operator action and should be one Save, not seven writes fired as they happen.
//
// Ordering within the save matters and is not arbitrary:
//   1. deletes first — they free up nothing, but doing them last would mean
//      reordering a list that still contains stages we are about to remove.
//   2. updates and creates next, so every surviving stage has a real id.
//   3. reorder last, over the complete final id list. It is the only call that
//      can express "these five, in this order", and it needs all five to exist.

import { api } from '../../lib/api/client';
import { slugify } from '../../lib/slugify';
import type { StageDraft, WorkflowDraft } from './workflow-data';
import type { DocumentStage, DocumentWorkflowDetail } from './types';

/** A problem the operator can fix, phrased for them rather than for a log. */
export class WorkflowValidationError extends Error {}

export interface SaveWorkflowInput {
  /** 'new', or the id of an existing workflow. */
  id: string;
  draft: WorkflowDraft;
  /**
   * The workflow exactly as the server last returned it — the delete baseline,
   * and the authority on whether this is a create at all.
   *
   * `id` deliberately does NOT decide that. A pane opened at `{id:'new'}` keeps
   * that param until it retargets itself after the first successful save, so
   * trusting `id` means a second save landing in that window creates a SECOND
   * workflow instead of updating the one just made. The baseline is set the
   * moment the server confirms, so it is the honest answer.
   */
  original: DocumentWorkflowDetail | null;
}

/** '' and absent are the same thing to us, and the API rejects '' outright
 *  (numberPrefix is min(1) when present), so both collapse to null. */
function prefixOf(stage: StageDraft): string | null {
  const trimmed = stage.numberPrefix.trim();
  // A prefix on a stage that does not number anything is dead data that would
  // resurface confusingly if the flag were ever switched back on.
  if (!stage.numberOnEnter || trimmed === '') return null;
  return trimmed;
}

function stageBody(stage: StageDraft, sortOrder: number): Record<string, unknown> {
  return {
    name: stage.name.trim(),
    customerLabel: stage.customerLabel.trim(),
    stageType: stage.stageType,
    snapshotOnEnter: stage.snapshotOnEnter,
    numberOnEnter: stage.numberOnEnter,
    numberPrefix: prefixOf(stage),
    locksEditing: stage.locksEditing,
    sortOrder,
  };
}

/** True when anything the server stores about this stage differs. sortOrder is
 *  excluded deliberately — reorder owns it, and including it here would fire a
 *  PATCH for every stage below a moved one. */
function stageChanged(stage: StageDraft, before: DocumentStage): boolean {
  return (
    stage.name.trim() !== before.name ||
    stage.customerLabel.trim() !== before.customerLabel ||
    stage.stageType !== before.stageType ||
    stage.snapshotOnEnter !== before.snapshotOnEnter ||
    stage.numberOnEnter !== before.numberOnEnter ||
    prefixOf(stage) !== before.numberPrefix ||
    stage.locksEditing !== before.locksEditing
  );
}

/**
 * Everything the operator must fix before anything is written, gathered in one
 * pass so the first save attempt reports ALL of it rather than one problem per
 * round trip.
 */
function validate(draft: WorkflowDraft): void {
  if (draft.name.trim() === '') {
    throw new WorkflowValidationError('Give this workflow a name.');
  }
  if (draft.slug.trim() === '') {
    throw new WorkflowValidationError(
      'This workflow needs a short reference name made of letters, numbers and dashes.'
    );
  }
  if (draft.stages.length === 0) {
    throw new WorkflowValidationError(
      'A workflow needs at least one stage — that is the step a document sits at.'
    );
  }
  const unnamed = draft.stages.findIndex(
    (stage) => stage.name.trim() === '' || stage.customerLabel.trim() === ''
  );
  if (unnamed !== -1) {
    throw new WorkflowValidationError(
      `Stage ${String(unnamed + 1)} needs both a name for your team and a name your customers see.`
    );
  }
}

export async function saveWorkflow(input: SaveWorkflowInput): Promise<DocumentWorkflowDetail> {
  const { original } = input;
  // Tidied on the way out: the reference-name field keeps a trailing hyphen
  // while it is being typed, so a hyphen can survive being pressed (issue #181).
  const draft = { ...input.draft, slug: slugify(input.draft.slug, 63) };
  validate(draft);

  if (original === null) {
    const created = await api.post<DocumentWorkflowDetail>('/v1/invoicing/workflows', {
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      isDefault: draft.isDefault,
      sortOrder: 0,
    });
    // Sequential, not Promise.all: the stages are created in list order and
    // each carries its index as sortOrder, so a parallel burst that lands out
    // of order would still be correct — but it would also make a partial
    // failure leave a half-built workflow with no way to say which stages made
    // it. One at a time, the first failure stops the rest.
    for (const [index, stage] of draft.stages.entries()) {
      await api.post(`/v1/invoicing/workflows/${created.id}/stages`, stageBody(stage, index));
    }
    return api.get<DocumentWorkflowDetail>(`/v1/invoicing/workflows/${created.id}`);
  }

  // From here the baseline is the workflow being edited, so its id is the one to
  // write to — see the note on `original` above for why `input.id` is not.
  const id = original.id;

  const headerChanged =
    draft.name.trim() !== original.name ||
    draft.slug.trim() !== original.slug ||
    draft.isDefault !== original.isDefault;

  if (headerChanged) {
    await api.patch(`/v1/invoicing/workflows/${id}`, {
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      isDefault: draft.isDefault,
    });
  }

  // 1. Deletes — anything the server has that the draft no longer lists.
  const keptIds = new Set(draft.stages.map((stage) => stage.id).filter(Boolean));
  for (const before of original.stages) {
    if (!keptIds.has(before.id)) {
      await api.delete(`/v1/invoicing/workflows/${id}/stages/${before.id}`);
    }
  }

  // 2. Updates and creates. The resulting id list is built in draft order as we
  //    go, which is exactly what the reorder call needs.
  const beforeById = new Map(original.stages.map((stage) => [stage.id, stage]));
  const finalOrder: string[] = [];

  for (const [index, stage] of draft.stages.entries()) {
    const before = stage.id ? beforeById.get(stage.id) : undefined;
    if (stage.id && before) {
      if (stageChanged(stage, before)) {
        // sortOrder is omitted from the body — step 3 owns ordering, and the
        // PATCH shape no longer fabricates defaults for what we leave out
        // (see UpdateDocumentStageInput in @wizeworks/crm-schemas).
        const { sortOrder: _sortOrder, ...body } = stageBody(stage, index);
        await api.patch(`/v1/invoicing/workflows/${id}/stages/${stage.id}`, body);
      }
      finalOrder.push(stage.id);
      continue;
    }
    const created = await api.post<{ id: string }>(
      `/v1/invoicing/workflows/${id}/stages`,
      stageBody(stage, index)
    );
    finalOrder.push(created.id);
  }

  // 3. Reorder, only when the final sequence differs from the stored one — a
  //    save that only renamed a stage skips it. Adds and deletes change the
  //    length and so always reorder: redundant when a stage was simply appended
  //    (it already carries its index as sortOrder), but a delete from the middle
  //    leaves a gap that only this call closes, and the two are not worth
  //    telling apart for one idempotent request.
  const storedOrder = original.stages.map((stage) => stage.id);
  const orderChanged =
    finalOrder.length !== storedOrder.length ||
    finalOrder.some((stageId, index) => stageId !== storedOrder[index]);

  if (orderChanged && finalOrder.length > 0) {
    await api.post(`/v1/invoicing/workflows/${id}/stages/reorder`, { stageIds: finalOrder });
  }

  return api.get<DocumentWorkflowDetail>(`/v1/invoicing/workflows/${id}`);
}
