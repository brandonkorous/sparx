'use client';

// One workflow — its name, and the stages a document travels through.
//
// Create and edit are the same surface (`{id:'new'}` → `{id}`), per the app's
// pane rule: a workflow is a durable thing you come back to, and building one is
// minutes of work with real content to lose, so it could never have been a
// modal. Saving a new one retargets this pane at the saved workflow rather than
// opening a second tab, so the operator keeps working in the pane they were
// already in.
//
// Explicit save, last-write-wins, one button — the platform rule for every
// editor. The whole workflow including its stage list is one draft, and
// ./workflow-save.ts turns that draft into the four separate writes the API
// actually needs. That is the entire reason a diff exists: reordering the stages
// and renaming two of them is ONE thing the operator did.

import { useEffect, useState } from 'react';
import { useMutation } from '@sparx/query';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
  useImperativeAlertDialog,
  useToast,
} from '@wizeworks/silicaui-react';
import { Archive, ArrowRight, MoreHorizontal, Save } from 'lucide-react';
import { EditorLayout, EDITOR_RAIL_STICKY } from '../../components/editor-layout';
import { FormSection } from '../../components/form-section';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { StageList } from './stage-list';
import { stageTone, type DocumentWorkflowDetail } from './types';
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

/** The rail: the stage sequence as a customer would meet it, which is the one
 *  reading of this screen the form itself cannot give. The form is six fields
 *  per stage in a vertical list; this is the shape of the journey. */
function CustomerView({ draft }: { draft: WorkflowDraft }) {
  const named = draft.stages.filter((stage) => stage.customerLabel.trim() !== '');

  return (
    <section className={`card bg-base-100 flex flex-col gap-3 p-4 ${EDITOR_RAIL_STICKY}`}>
      <Text className="text-base font-semibold">What your customers see</Text>
      {named.length === 0 ? (
        <Text className="text-sm">
          Name your stages and the journey a customer takes appears here.
        </Text>
      ) : (
        <ol className="flex flex-col gap-2">
          {named.map((stage, index) => (
            <li key={stage.key} className="flex items-start gap-2">
              {index > 0 ? (
                <ArrowRight className="mt-1 size-4 shrink-0" aria-hidden />
              ) : (
                <span className="mt-1 inline-block size-4 shrink-0" aria-hidden />
              )}
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{stage.customerLabel.trim()}</span>
                  <Badge color={stageTone(stage.stageType)} variant="soft" size="sm">
                    {stage.stageType}
                  </Badge>
                </span>
                {stage.numberOnEnter ? (
                  <Text className="text-sm">
                    Numbered {stage.numberPrefix.trim() || ''}
                    000001 onwards
                  </Text>
                ) : null}
                {stage.locksEditing ? <Text className="text-sm">No further edits</Text> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function WorkflowEditorSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';

  const { data: workflow, isPending, isError } = useWorkflow(id);
  const invalidate = useInvalidateWorkflows();
  const archive = useArchiveWorkflow();
  const toast = useToast();
  const confirm = useImperativeAlertDialog();

  const [draft, setDraft] = useState<WorkflowDraft>(emptyWorkflowDraft);
  const [dirty, setDirty] = useState(false);
  // Once the operator has typed a reference name of their own, the name field
  // stops overwriting it — otherwise fixing a typo in the title silently
  // rewrites a slug that may already be linked to from elsewhere.
  const [slugTouched, setSlugTouched] = useState(false);
  /**
   * The workflow as the server last confirmed it — the baseline the save diff
   * reconciles against.
   *
   * Held in state rather than read straight off the query, and that is
   * load-bearing. A save CREATES stages, which means the ids in `draft` and the
   * stage list in the baseline are both stale the instant it returns. Waiting
   * for the invalidated query to come back and fix them leaves a window where a
   * second save still sees `id: null` on stages that now exist — and creates
   * every one of them a second time. `saveWorkflow` returns the reconciled
   * workflow precisely so both can be corrected synchronously here.
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

  // Guarded on `dirty` so a background refetch can never overwrite what someone
  // is part-way through typing.
  useEffect(() => {
    if (!workflow || dirty) return;
    adopt(workflow);
    // ctx is stable per pane, and adopt is recreated each render by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow]);

  const save = useMutation({
    mutationFn: () => saveWorkflow({ id, draft, original }),
    onSuccess: (saved) => {
      setDirty(false);
      // Re-adopting regenerates the stage rows' session keys, so any expanded
      // row collapses. That is a fair price for the draft and the baseline both
      // being exactly what the server now holds.
      adopt(saved);
      invalidate();
      toast.add({ title: isNew ? 'Workflow created' : 'Workflow saved', type: 'success' });
      if (isNew) ctx.open('invoicing.workflow.edit', { id: saved.id }, { target: 'replace' });
    },
  });

  const update = (patch: Partial<WorkflowDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

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
      <div className="p-4">
        <Alert color="danger" variant="soft">
          This workflow could not be loaded. It may have been archived, or this is a problem
          reaching the server.
        </Alert>
      </div>
    );
  }

  if (isPending && !isNew) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Editor actions" wrap>
        {original?.archivedAt ? (
          <Badge color="neutral" variant="soft" size="sm">
            Archived
          </Badge>
        ) : null}
        {draft.isDefault ? (
          <Badge color="module" variant="soft" size="sm">
            Default
          </Badge>
        ) : null}
        <div className="flex-1" />
        {original ? (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button size="sm" variant="ghost" color="neutral" aria-label="More actions">
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  void onArchive();
                }}
              >
                <Archive className="size-4" aria-hidden />
                Archive workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button
          color="module"
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          <Save className="size-4" aria-hidden />
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          <EditorLayout
            banner={
              failure ? (
                <Alert color="danger" variant="soft">
                  {failure}
                </Alert>
              ) : null
            }
            main={
              <>
                <FormSection
                  title="Workflow"
                  description="A workflow is the path a document takes, and who sees what along the way."
                >
                  <Field>
                    <FieldLabel>Name</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={draft.name}
                          placeholder="Service / Repair"
                          onChange={(event) => {
                            const name = event.target.value;
                            update(slugTouched ? { name } : { name, slug: slugify(name) });
                          }}
                        />
                      }
                    />
                    <FieldDescription>
                      How your team picks this when starting a new document.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel>Reference name</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={draft.slug}
                          placeholder="service-repair"
                          onChange={(event) => {
                            setSlugTouched(true);
                            update({ slug: slugify(event.target.value) });
                          }}
                        />
                      }
                    />
                    <FieldDescription>
                      A short version with no spaces, used behind the scenes. Filled in from the
                      name — change it only if you have a reason to.
                    </FieldDescription>
                  </Field>

                  <label className="flex items-start gap-2">
                    <Checkbox
                      color="module"
                      className="mt-1"
                      checked={draft.isDefault}
                      aria-label="Use this workflow by default"
                      onChange={(event) => {
                        update({ isDefault: event.target.checked });
                      }}
                    />
                    <span className="flex flex-col gap-0.5">
                      <Text as="span">Use this one by default</Text>
                      <Text as="span" className="text-sm">
                        New documents start on this workflow unless someone picks another. Only one
                        workflow can be the default — turning this on turns it off elsewhere.
                      </Text>
                    </span>
                  </label>
                </FormSection>

                <FormSection
                  title="Stages"
                  description="The steps a document moves through, in order. Drag a stage, or use the arrows, to change where it sits."
                >
                  <StageList
                    stages={draft.stages}
                    onChange={(stages) => {
                      update({ stages });
                    }}
                  />
                </FormSection>
              </>
            }
            rail={<CustomerView draft={draft} />}
          />
        </div>
      </div>
    </div>
  );
}
