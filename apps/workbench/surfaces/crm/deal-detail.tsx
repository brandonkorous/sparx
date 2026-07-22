'use client';

// One deal — open it, then work it toward a close.
//
// Add and manage are the SAME surface: `{ id: 'new' }` starts a deal, `{ id }`
// manages one. A deal lives on a pipeline at a stage; moving it between stages
// goes through its own endpoint (so the automations that watch for "reached
// Won" still fire), which is why a stage change on save is applied separately
// from an ordinary edit. The title is a field, not a repeated heading.
//
// The normal way a deal leaves the board is a move to a Won or Lost stage, which
// keeps it in the pipeline's history. Delete (behind a confirm, in a quiet row
// after the work) is the escape hatch for a deal added by mistake — it soft-
// deletes, so the row and its history survive.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Select,
  TagInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { Trash2 } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useTeamRoster } from '../../lib/api/team';
import { customerName, useCustomers } from './customers-data';
import { usePipelines, stageTypeMeta, type Pipeline } from './pipelines-data';
import {
  dealErrorMessage,
  useCreateDeal,
  useDeal,
  useDeleteDeal,
  useMoveDealStage,
  useUpdateDeal,
  type Deal,
  type DealInput,
} from './deals-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

interface Draft {
  title: string;
  valueDollars: string;
  currency: string;
  probability: string;
  expectedCloseDate: string;
  source: string;
  pipelineId: string;
  stageId: string;
  customerId: string;
  assignedRepId: string;
  tags: string[];
}

function emptyDraft(): Draft {
  return {
    title: '',
    valueDollars: '',
    currency: 'USD',
    probability: '',
    expectedCloseDate: '',
    source: '',
    pipelineId: '',
    stageId: '',
    customerId: '',
    assignedRepId: '',
    tags: [],
  };
}

function toDraft(deal: Deal): Draft {
  const value = Number(deal.value);
  const prob = Number(deal.probability);
  return {
    title: deal.title,
    valueDollars: value > 0 ? String(value) : '',
    currency: deal.currency,
    probability: prob > 0 ? String(prob) : '',
    expectedCloseDate: deal.expectedCloseDate ?? '',
    source: deal.source ?? '',
    pipelineId: deal.pipelineId,
    stageId: deal.stageId,
    customerId: deal.customerId ?? '',
    assignedRepId: deal.assignedRepId ?? '',
    tags: deal.tags,
  };
}

const trimOrNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/* ── Surface ────────────────────────────────────────────────────────────── */

export function DealDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <DealEditor ctx={ctx} id="new" /> : <DealLoader ctx={ctx} id={id} />;
}

function DealLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data: deal, isPending, isError, refetch } = useDeal(id);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load this deal</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server, or the deal has been removed. Nothing has been
              changed.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="error"
            variant="soft"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  if (isPending || !deal) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return <DealEditor ctx={ctx} id={id} deal={deal} />;
}

function DealEditor({ ctx, id, deal }: { ctx: SurfaceContext; id: string; deal?: Deal }) {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const create = useCreateDeal();
  const update = useUpdateDeal(id);
  const moveStage = useMoveDealStage(id);
  const remove = useDeleteDeal(id);

  const { members: roster } = useTeamRoster();
  const { data: customers } = useCustomers({});
  const { data: pipelines } = usePipelines();

  const saved = useMemo(() => (deal ? toDraft(deal) : emptyDraft()), [deal]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  // A new deal defaults to the first pipeline and its first stage.
  const pipelineList = useMemo(() => pipelines?.items ?? [], [pipelines]);
  useEffect(() => {
    if (isNew && !touched && draft.pipelineId === '' && pipelineList.length > 0) {
      const first = pipelineList[0];
      if (first) {
        setDraft((cur) => ({
          ...cur,
          pipelineId: first.id,
          stageId: first.stages[0]?.id ?? '',
        }));
      }
    }
  }, [isNew, touched, draft.pipelineId, pipelineList]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New deal' : deal ? deal.title : 'Deal');
  }, [ctx, isNew, deal]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const currentPipeline: Pipeline | undefined = pipelineList.find((p) => p.id === draft.pipelineId);
  const stages = currentPipeline?.stages ?? [];
  const currentStage = stages.find((s) => s.id === draft.stageId);

  const changePipeline = (pipelineId: string) => {
    const pipeline = pipelineList.find((p) => p.id === pipelineId);
    setTouched(true);
    setDraft((cur) => ({
      ...cur,
      pipelineId,
      // Moving pipeline invalidates the old stage — land on the new one's first.
      stageId: pipeline?.stages[0]?.id ?? '',
    }));
  };

  const dirty = touched && JSON.stringify(draft) !== JSON.stringify(saved);
  const saving = create.isPending || update.isPending || moveStage.isPending;

  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This deal has not been created yet. Close anyway?'
      : 'This deal has unsaved changes. Close anyway?'
  );

  const repItems = useMemo(() => {
    const items: Record<string, string> = { '': 'No one assigned' };
    for (const m of roster) items[m.userId] = m.name ?? m.email;
    if (draft.assignedRepId && !items[draft.assignedRepId]) {
      items[draft.assignedRepId] = 'A former team member';
    }
    return items;
  }, [roster, draft.assignedRepId]);

  const customerItems = useMemo(() => {
    const items: Record<string, string> = { '': 'No customer linked' };
    for (const c of customers?.items ?? []) items[c.id] = customerName(c);
    if (draft.customerId && !items[draft.customerId])
      items[draft.customerId] = 'A removed customer';
    return items;
  }, [customers, draft.customerId]);

  /* ── Validation ───────────────────────────────────────────────────────── */

  const titleError = draft.title.trim() === '' ? 'Give the deal a title.' : null;
  const pipelineError = draft.pipelineId === '' ? 'Choose a pipeline.' : null;
  const stageError = draft.stageId === '' ? 'Choose a stage.' : null;
  const valueError =
    draft.valueDollars.trim() !== '' && !(Number(draft.valueDollars) >= 0)
      ? 'Enter the value as a number, or leave it blank.'
      : null;
  const blocked = titleError ?? pipelineError ?? stageError ?? valueError;

  const failure =
    create.isError || update.isError || moveStage.isError
      ? dealErrorMessage(
          create.error ?? update.error ?? moveStage.error,
          'Could not save this deal. Nothing was changed.'
        )
      : null;

  /* ── Submit ───────────────────────────────────────────────────────────── */

  const scalarInput = (): Omit<DealInput, 'pipelineId' | 'stageId'> => ({
    title: draft.title.trim(),
    value: draft.valueDollars.trim() === '' ? 0 : Number(draft.valueDollars),
    currency: draft.currency,
    probability: draft.probability.trim() === '' ? 0 : Number(draft.probability),
    expectedCloseDate: draft.expectedCloseDate.trim() === '' ? null : draft.expectedCloseDate,
    source: trimOrNull(draft.source),
    customerId: draft.customerId || null,
    assignedRepId: draft.assignedRepId || null,
    tags: draft.tags,
  });

  const submit = () => {
    if (blocked) return;

    if (isNew) {
      const input: DealInput = {
        ...scalarInput(),
        pipelineId: draft.pipelineId,
        stageId: draft.stageId,
      };
      create.mutate(input, {
        onSuccess: (created) => {
          ctx.open('crm.deal.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${created.title} created`, type: 'success' });
          });
        },
      });
      return;
    }

    // Existing: patch the scalar fields (incl. pipeline), then move the stage
    // through its own endpoint if it changed, so the stage-changed event fires.
    const stageChanged = deal ? draft.stageId !== deal.stageId : false;
    update.mutate(
      { ...scalarInput(), pipelineId: draft.pipelineId },
      {
        onSuccess: () => {
          if (stageChanged) {
            moveStage.mutate(
              { toStageId: draft.stageId },
              {
                onSuccess: () => {
                  setTouched(false);
                  toast.add({ title: 'Deal saved', type: 'success' });
                },
              }
            );
          } else {
            setTouched(false);
            toast.add({ title: 'Deal saved', type: 'success' });
          }
        },
      }
    );
  };

  const onDelete = async () => {
    if (!deal) return;
    const ok = await confirm({
      title: `Delete ${deal.title}?`,
      description:
        'This is for a deal that should not exist — the usual way to finish a deal is to move it to a Won or Lost stage. Deleting takes it out of your lists; its history is kept and it can be brought back by support if needed.',
      confirmLabel: 'Delete this deal',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${deal.title} deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete this deal',
          description: dealErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const stageMeta = stageTypeMeta(currentStage?.stageType ?? 'open');

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Deal actions">
        <Badge color={stageMeta.tone} variant="soft" size="sm">
          {currentStage?.name ?? stageMeta.label}
        </Badge>
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          loading={saving}
          disabled={Boolean(blocked) || (!isNew && !dirty)}
          onClick={submit}
        >
          {isNew ? 'Create deal' : 'Save'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Start a deal
              </Heading>
              <Text>
                A deal is a sale you are working on. Put it on a pipeline, set what it is worth, and
                move it along as it progresses.
              </Text>
            </div>
          ) : null}

          {failure ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not save this deal</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {pipelineList.length === 0 ? (
            <Alert color="warning" variant="soft">
              <AlertContent>
                <AlertTitle>No pipelines yet</AlertTitle>
                <AlertDescription>
                  A deal needs a pipeline to live on. Create one under Pipelines first, then come
                  back.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection title="The deal">
            <Field>
              <FieldLabel>Title</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color={titleError && touched ? 'error' : 'module'}
                    value={draft.title}
                    placeholder="Fleet servicing contract"
                    onChange={(event) => {
                      set('title', event.target.value);
                    }}
                  />
                }
              />
              {titleError && touched ? (
                <FieldStatus status="error">{titleError}</FieldStatus>
              ) : null}
            </Field>

            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Value</FieldLabel>
                <FieldControl
                  render={
                    <div className="flex max-w-[14rem] items-center gap-2">
                      <Input
                        color={valueError && touched ? 'error' : 'module'}
                        type="number"
                        min={0}
                        step="1"
                        inputMode="decimal"
                        value={draft.valueDollars}
                        placeholder="0"
                        onChange={(event) => {
                          set('valueDollars', event.target.value);
                        }}
                      />
                      <Input
                        color="module"
                        aria-label="Currency"
                        value={draft.currency}
                        spellCheck={false}
                        className="max-w-[5rem] font-mono uppercase"
                        onChange={(event) => {
                          set('currency', event.target.value.toUpperCase().slice(0, 3));
                        }}
                      />
                    </div>
                  }
                />
                {valueError && touched ? (
                  <FieldStatus status="error">{valueError}</FieldStatus>
                ) : (
                  <FieldDescription>What the deal is worth if it closes.</FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel>Likelihood</FieldLabel>
                <FieldControl
                  render={
                    <div className="flex max-w-[10rem] items-center gap-2">
                      <Input
                        color="module"
                        type="number"
                        min={0}
                        max={100}
                        inputMode="numeric"
                        value={draft.probability}
                        placeholder="0"
                        onChange={(event) => {
                          set('probability', event.target.value);
                        }}
                      />
                      <Text as="span" className="text-lg">
                        %
                      </Text>
                    </div>
                  }
                />
                <FieldDescription>Your rough chance of winning it.</FieldDescription>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Where it is">
            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>Pipeline</FieldLabel>
                <Select
                  color={pipelineError && touched ? 'error' : 'module'}
                  aria-label="Pipeline"
                  value={draft.pipelineId}
                  items={Object.fromEntries(pipelineList.map((p) => [p.id, p.name]))}
                  onValueChange={(next) => {
                    changePipeline(next as string);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>Stage</FieldLabel>
                <Select
                  color={stageError && touched ? 'error' : 'module'}
                  aria-label="Stage"
                  value={draft.stageId}
                  items={Object.fromEntries(stages.map((s) => [s.id, s.name]))}
                  onValueChange={(next) => {
                    set('stageId', next as string);
                  }}
                />
                <FieldDescription>Where the deal sits on this pipeline right now.</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel>Expected close date</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    type="date"
                    className="max-w-[14rem]"
                    value={draft.expectedCloseDate}
                    onChange={(event) => {
                      set('expectedCloseDate', event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>When you think it will close. Optional.</FieldDescription>
            </Field>
          </FormSection>

          <FormSection title="Who and where from">
            <Field>
              <FieldLabel>Customer</FieldLabel>
              <Select
                color="module"
                aria-label="Linked customer"
                value={draft.customerId}
                items={customerItems}
                onValueChange={(next) => {
                  set('customerId', next as string);
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Looked after by</FieldLabel>
              <Select
                color="module"
                aria-label="Which team member owns this deal"
                value={draft.assignedRepId}
                items={repItems}
                onValueChange={(next) => {
                  set('assignedRepId', next as string);
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Where it came from</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={draft.source}
                    placeholder="Referral, trade show, website…"
                    onChange={(event) => {
                      set('source', event.target.value);
                    }}
                  />
                }
              />
            </Field>
            <Field>
              <FieldLabel>Labels</FieldLabel>
              <FieldControl
                render={
                  <TagInput
                    color="module"
                    value={draft.tags}
                    placeholder="Type a label and press Enter"
                    aria-label="Labels"
                    onValueChange={(next) => {
                      set('tags', next);
                    }}
                  />
                }
              />
            </Field>
          </FormSection>

          {!isNew && deal ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Text className="text-sm">
                Finish a deal by moving it to a Won or Lost stage. Delete is for one added by
                mistake — its history is kept.
              </Text>
              <Button
                size="sm"
                variant="outline"
                color="danger"
                loading={remove.isPending}
                onClick={() => {
                  void onDelete();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete this deal
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
