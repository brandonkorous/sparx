// What "unsaved changes" is allowed to mean (issue 780).
//
// The workflow editor adopts the saved workflow in an effect GUARDED ON DIRTY,
// so a background refetch can never overwrite half-typed work. That guard makes
// the dirty comparison load-bearing in a way a stale-flag bug normally is not:
// get it wrong in the "always dirty" direction and the pane never adopts at
// all, so every saved workflow opens as a blank new one.
//
// It was wrong in exactly that direction for six days. Each stage draft carries
// a `key` — a random session-only React key, re-minted by `newStageKey()` on
// every single read — and the baseline was built by calling
// `emptyWorkflowDraft()` a second time. Two calls, two random keys, never
// equal.
//
// So the assertions below are about two calls describing the SAME thing being
// equal, which is the property a raw `JSON.stringify` cannot have.

import { describe, expect, it } from 'vitest';
import {
  comparableWorkflow,
  emptyWorkflowDraft,
  toWorkflowDraft,
  type WorkflowDraft,
} from './workflow-data';
import type { DocumentWorkflowDetail } from './types';

const SERVER: DocumentWorkflowDetail = {
  id: 'wf-1',
  name: 'Invoice',
  slug: 'invoice',
  isDefault: true,
  sortOrder: 0,
  archivedAt: null,
  stages: [
    {
      id: 'st-1',
      name: 'Invoice',
      customerLabel: 'Invoice',
      stageType: 'open',
      snapshotOnEnter: false,
      numberOnEnter: true,
      numberPrefix: 'INV-',
      locksEditing: false,
      sortOrder: 0,
    },
    {
      id: 'st-2',
      name: 'Receipt',
      customerLabel: 'Receipt',
      stageType: 'paid',
      snapshotOnEnter: true,
      numberOnEnter: false,
      numberPrefix: null,
      locksEditing: true,
      sortOrder: 1,
    },
  ],
};

describe('the unsaved-changes comparison', () => {
  it('calls the same empty draft twice and gets one answer', () => {
    // The exact shape the editor builds: the draft from one call, the baseline
    // from another. Unequal here means the pane is dirty before anyone has
    // touched it, and therefore never adopts.
    expect(comparableWorkflow(emptyWorkflowDraft())).toBe(comparableWorkflow(emptyWorkflowDraft()));
  });

  it('is not fooled by the random key that made this go wrong', () => {
    // Why the helper exists at all. If this ever stops being true, the keys
    // have become stable and the comparison could be raw again — but until
    // then, a raw serialization of two identical drafts DIFFERS.
    expect(JSON.stringify(emptyWorkflowDraft())).not.toBe(JSON.stringify(emptyWorkflowDraft()));
  });

  it('reads one server workflow twice and gets one answer', () => {
    // `toWorkflowDraft` re-mints every key, so a refetch that changed nothing
    // must still compare equal or the pane goes dirty on its own.
    expect(comparableWorkflow(toWorkflowDraft(SERVER))).toBe(
      comparableWorkflow(toWorkflowDraft(SERVER))
    );
  });

  it('still notices a renamed stage', () => {
    const before = toWorkflowDraft(SERVER);
    const after: WorkflowDraft = {
      ...before,
      stages: before.stages.map((stage, index) =>
        index === 1 ? { ...stage, customerLabel: 'Paid in full' } : stage
      ),
    };
    expect(comparableWorkflow(after)).not.toBe(comparableWorkflow(before));
  });

  it('still notices a removed stage, a reorder, and a renamed workflow', () => {
    const before = toWorkflowDraft(SERVER);

    const removed: WorkflowDraft = { ...before, stages: before.stages.slice(0, 1) };
    expect(comparableWorkflow(removed)).not.toBe(comparableWorkflow(before));

    const reordered: WorkflowDraft = { ...before, stages: [...before.stages].reverse() };
    expect(comparableWorkflow(reordered)).not.toBe(comparableWorkflow(before));

    const renamed: WorkflowDraft = { ...before, name: 'Retail invoice' };
    expect(comparableWorkflow(renamed)).not.toBe(comparableWorkflow(before));

    // And the one that decides which workflow new documents start on.
    const undefaulted: WorkflowDraft = { ...before, isDefault: false };
    expect(comparableWorkflow(undefaulted)).not.toBe(comparableWorkflow(before));
  });
});
