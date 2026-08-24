'use client';

// One workflow — its name, and the stages a document travels through.
//
// The body is a two-pane working surface — ./workflow-editor-panes.tsx.
//
// Create and edit are the same surface (`{id:'new'}` → `{id}`), per the app's pane
// rule: a workflow is a durable thing you come back to, and building one is minutes
// of work with real content to lose, so it could never have been a modal. Saving a
// new one retargets this pane at the saved workflow rather than opening a second
// tab, so the operator keeps working in the pane they were already in.
//
// Explicit save, last-write-wins, one button — the platform rule for every editor.
// Invoicing workflows are NOT versioned: there is no draft/publish here, unlike
// automations. The parity with automations is the two-pane canvas+inspector feel,
// not the versioning toolbar. The whole workflow including its stage list is one
// draft, and ./workflow-save.ts turns that draft into the four separate writes the
// API actually needs — reordering the stages and renaming two of them is ONE thing
// the operator did.

import { useEffect, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { useMutation } from '@wizeworks/query';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { WorkflowPanes } from './workflow-editor-panes';
import { WorkflowToolbar } from './workflow-editor-toolbar';
import { useStageOps } from './workflow-editor-stages';
import { slugifyTyping } from '../../lib/slugify';
import type { DocumentWorkflowDetail } from './types';
import {
  emptyWorkflowDraft,
  slugify,
  toWorkflowDraft,
  useArchiveWorkflow,
  useInvalidateWorkflows,
  useWorkflow,
  workflowErrorMessage,
  type WorkflowDraft,
} from './workflow-data';
import { saveWorkflow, WorkflowValidationError } from './workflow-save';

export function WorkflowEditorSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';

  const {
    data: workflow,
    isPending,
    isError,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useWorkflow(id);
  const invalidate = useInvalidateWorkflows();
  const archive = useArchiveWorkflow();
  const toast = useToast();
  const confirm = useConfirm();

  const [draft, setDraft] = useState<WorkflowDraft>(emptyWorkflowDraft);
  const [dirty, setDirty] = useState(false);
  // Once the operator has typed a reference name of their own, the name field
  // stops overwriting it — otherwise fixing a typo in the title silently rewrites
  // a slug that may already be linked to from elsewhere.
  const [slugTouched, setSlugTouched] = useState(false);
  /**
   * The workflow as the server last confirmed it — the baseline the save diff
   * reconciles against.
   *
   * Held in state rather than read straight off the query, and that is
   * load-bearing. A save CREATES stages, which means the ids in `draft` and the
   * stage list in the baseline are both stale the instant it returns. Waiting for
   * the invalidated query to come back and fix them leaves a window where a second
   * save still sees `id: null` on stages that now exist — and creates every one of
   * them a second time. `saveWorkflow` returns the reconciled workflow precisely
   * so both can be corrected synchronously here.
   */
  const [original, setOriginal] = useState<DocumentWorkflowDetail | null>(null);

  useDirtySource(dirty, 'This workflow has unsaved changes. Close it anyway?');

  /** Adopt a server state as both the draft and the baseline. */
  const adopt = (next: DocumentWorkflowDetail) => {
    setDraft(toWorkflowDraft(next));
    setOriginal(next);
    setSlugTouched(true);
    ctx.setTitle(next.name);
  };

  // Guarded on `dirty` so a background refetch can never overwrite what someone is
  // part-way through typing.
  useEffect(() => {
    if (!workflow || dirty) return;
    adopt(workflow);
    // ctx is stable per pane, and adopt is recreated each render by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow]);

  useEffect(() => {
    ctx.setTitle(draft.name.trim() || (isNew ? 'New workflow' : 'Workflow'));
  }, [ctx, draft.name, isNew]);

  const update = (patch: Partial<WorkflowDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  // The stage list and which node the inspector is on — one job, its own file.
  const stageOps = useStageOps(draft.stages, (next) => {
    update({ stages: next });
  });

  // ── Settings callbacks ──
  const onName = (value: string) => {
    update(slugTouched ? { name: value } : { name: value, slug: slugify(value) });
  };
  const onSlug = (value: string) => {
    setSlugTouched(true);
    // Keeps a hyphen she just pressed; `slugify` on save takes a trailing one
    // off. Issue #181.
    update({ slug: slugifyTyping(value, 63) });
  };

  const save = useMutation({
    mutationFn: () => saveWorkflow({ id, draft, original }),
    onSuccess: (saved) => {
      setDirty(false);
      adopt(saved);
      invalidate();
      toast.add({ title: isNew ? 'Workflow created' : 'Workflow saved', type: 'success' });
      if (isNew) ctx.open('invoicing.workflow.edit', { id: saved.id }, { target: 'replace' });
    },
  });

  const onArchive = async () => {
    if (!original) return;
    const ok = await confirm({
      title: `Archive “${original.name}”?`,
      description:
        'It stops being offered when someone creates a document. Documents already using it are untouched and keep working exactly as they do now.',
      color: 'danger',
      confirmLabel: 'Archive workflow',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    archive.mutate(original.id, {
      onSuccess: () => {
        toast.add({ title: 'Workflow archived', type: 'success' });
        setDirty(false);
        ctx.close();
      },
      onError: (error) => {
        toast.add({
          title: 'Could not archive this workflow',
          description: workflowErrorMessage(error, 'Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  // A validation problem is the operator's to fix and says so in their words;
  // anything else is ours and shouldn't pretend to be actionable.
  const failure = save.error
    ? save.error instanceof WorkflowValidationError
      ? save.error.message
      : workflowErrorMessage(
          save.error,
          'This workflow could not be saved. It may be a temporary problem — try again in a moment.'
        )
    : null;

  if (isError) {
    return (
      <div className={PANE_SHELL}>
        <Alert color="danger" variant="soft">
          This workflow could not be loaded. It may have been archived, or this is a problem
          reaching the server.
        </Alert>
      </div>
    );
  }

  if (isPending && !isNew) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <WorkflowToolbar
        original={original}
        isDefault={draft.isDefault}
        dirty={dirty}
        saving={save.isPending}
        onSave={() => {
          save.mutate();
        }}
        onArchive={() => {
          void onArchive();
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={workflow ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      {failure ? (
        <Alert color="danger" variant="soft" className="shrink-0">
          <AlertContent>
            <AlertTitle>{isNew ? 'Cannot create this yet' : 'Cannot save this yet'}</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <WorkflowPanes
        draft={draft}
        stageOps={stageOps}
        onName={onName}
        onSlug={onSlug}
        onDefault={(value) => {
          update({ isDefault: value });
        }}
      />
    </div>
  );
}
