'use client';

// One campaign — set it up, turn it on, and read how it is doing.
//
// A PANE, not a modal, and creating one is the same pane with `{id:'new'}`. A
// campaign is a durable thing you come back to, its ladder takes minutes to get
// right, and the report you want beside it is the whole reason to open it.
//
// ── WHY THE REPORT IS ABOVE THE SETTINGS ───────────────────────────────────
//
// A campaign is set up once and looked at for months. Putting the form first
// would make the common visit scroll past a form nobody is editing to reach the
// number they came for. A new campaign has no report, so the order inverts
// itself: with nothing to show, the setup IS the top of the pane.
//
// ── WHAT THE ACTIVATION BUTTON HAS TO SAY ──────────────────────────────────
//
// The server refuses to turn on a campaign with no goal, and refuses to activate
// one whose page-counting step has no page. Those are good rules and a 400 is a
// bad way to learn them, so the button is disabled with the reason written
// beside it. The server check stays: this is the explanation, not the guard.

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { Pause, Play, ServerCrash, Target, Trash2 } from 'lucide-react';
import { EMPTY_CONDITION_GROUP, type ConditionGroup } from '@wizeworks/automation-schemas';
import { PANE_SHELL, PaneToolbar } from '../../components/pane-toolbar';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useActiveSiteId, useViewer } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { ConditionEditor } from '../automations/condition-editor';
import { LadderReport } from './ladder';
import { StageLadderEditor } from './stage-editor';
import {
  KIND_BLURB,
  KIND_LABEL,
  canEditCampaigns,
  funnelErrorMessage,
  statusMeta,
  useCreateFunnel,
  useDeleteFunnel,
  useFunnel,
  useLadder,
  useUpdateFunnel,
  type FunnelKind,
  type FunnelStage,
} from './data';

const RANGE_DAYS = [7, 30, 90] as const;

/** A stored goal, or an empty group. The column is JSON and a campaign written
 *  before a shape change must not take the editor down with it. */
function asGoal(value: unknown): ConditionGroup {
  if (value && typeof value === 'object' && 'conditions' in value) return value as ConditionGroup;
  return EMPTY_CONDITION_GROUP;
}

/* ── Creating one ─────────────────────────────────────────────────────────── */

/**
 * The new-campaign form: a name and what kind of thing it is, and nothing else.
 *
 * The kind picks the starting ladder, so choosing it well is worth a sentence
 * each — and everything else (the steps, the goal, what it is worth) is easier
 * to decide once there is a campaign on screen to decide it about.
 */
function NewCampaign({ ctx }: { ctx: SurfaceContext }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FunnelKind>('lead');
  const create = useCreateFunnel();
  const siteId = useActiveSiteId().data?.propertyId ?? null;
  const toast = useToast();

  useDirtySource(
    name.trim().length > 0 && !create.isSuccess,
    'This campaign has not been saved yet. Close anyway?'
  );

  const submit = () => {
    if (!siteId || !name.trim()) return;
    create.mutate(
      { propertyId: siteId, name: name.trim(), kind },
      {
        onSuccess: (funnel) => {
          toast.add({ title: `${funnel.name} created`, type: 'success' });
          // Replaces this pane rather than opening a second one: the thing that
          // was being created and the thing now being edited are one campaign.
          ctx.open('funnels.campaign', { id: funnel.id }, { target: 'replace' });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
          <Heading level={2} className="text-lg font-semibold">
            Start a campaign
          </Heading>

          <Field>
            <FieldLabel>What is it called?</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  placeholder="Spring service promotion"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              }
            />
          </Field>

          <Field>
            <FieldLabel>What is it for?</FieldLabel>
            <FieldControl
              render={
                <Select
                  color="module"
                  value={kind}
                  onValueChange={(value) => {
                    setKind(value as FunnelKind);
                  }}
                  items={(Object.keys(KIND_LABEL) as FunnelKind[]).map((k) => ({
                    value: k,
                    label: KIND_LABEL[k],
                  }))}
                />
              }
            />
            <FieldDescription>{KIND_BLURB[kind]}</FieldDescription>
          </Field>

          {create.isError ? (
            <Text className="text-danger text-sm">
              {funnelErrorMessage(create.error, 'That campaign could not be created.')}
            </Text>
          ) : null}

          <div>
            <Button
              color="module"
              disabled={!name.trim() || !siteId || create.isPending}
              onClick={submit}
            >
              Create it
            </Button>
          </div>
          <Text className="text-sm">
            It starts as a draft and counts nobody until you turn it on.
          </Text>
        </div>
      </div>
    </div>
  );
}

/* ── The report half ──────────────────────────────────────────────────────── */

function ReportPanel({ id }: { id: string }) {
  const [days, setDays] = useState<number>(30);
  const ladder = useLadder(id, days);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2">
        <Heading level={2} className="text-lg font-semibold">
          How it is doing
        </Heading>
        <div className="flex-1" />
        <div className="w-40">
          <Select
            size="sm"
            aria-label="Report period"
            value={String(days)}
            onValueChange={(value) => {
              setDays(Number(value));
            }}
            items={RANGE_DAYS.map((d) => ({ value: String(d), label: `Last ${String(d)} days` }))}
          />
        </div>
      </header>

      {ladder.isPending ? (
        <p className="text-sm" role="status">
          Loading…
        </p>
      ) : ladder.isError ? (
        <Text className="text-sm">
          {funnelErrorMessage(ladder.error, 'The report could not be loaded just now.')}
        </Text>
      ) : ladder.data ? (
        <LadderReport ladder={ladder.data} />
      ) : null}
    </section>
  );
}

/* ── The surface ──────────────────────────────────────────────────────────── */

export function CampaignSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  if (id === 'new') return <NewCampaign ctx={ctx} />;
  return <ExistingCampaign ctx={ctx} id={id} />;
}

function ExistingCampaign({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const funnel = useFunnel(id);
  const viewer = useViewer();
  const canEdit = canEditCampaigns(viewer.data?.role);
  const update = useUpdateFunnel(id);
  const remove = useDeleteFunnel();
  const toast = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [goal, setGoal] = useState<ConditionGroup>(EMPTY_CONDITION_GROUP);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Seed the form once per campaign. Keyed on the row's `updatedAt` rather than
  // on mount so a refetch after a save re-syncs, while typing is never
  // interrupted by a background refresh.
  const stamp = funnel.data ? `${funnel.data.id}:${funnel.data.updatedAt}` : null;
  useEffect(() => {
    if (!funnel.data || stamp === loadedFor) return;
    setName(funnel.data.name);
    setDescription(funnel.data.description ?? '');
    setStages(funnel.data.stages);
    setGoal(asGoal(funnel.data.goal));
    setLoadedFor(stamp);
    ctx.setTitle(funnel.data.name);
  }, [funnel.data, stamp, loadedFor, ctx]);

  const changed =
    funnel.data !== undefined &&
    (name !== funnel.data.name ||
      description !== (funnel.data.description ?? '') ||
      JSON.stringify(stages) !== JSON.stringify(funnel.data.stages) ||
      JSON.stringify(goal) !== JSON.stringify(asGoal(funnel.data.goal)));

  useDirtySource(canEdit && changed, 'This campaign has unsaved changes. Close anyway?');

  if (funnel.isPending) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      </div>
    );
  }

  if (funnel.isError || !funnel.data) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            icon={<ServerCrash className="size-6" aria-hidden />}
            title="Could not open this campaign"
            description={funnelErrorMessage(
              funnel.error,
              'It may have been deleted, or this is a problem reaching the server.'
            )}
          />
        </div>
      </div>
    );
  }

  const current = funnel.data;
  const meta = statusMeta(current.status);
  const running = current.status === 'active';

  // The two things the server insists on before a campaign may run. Said here
  // so the answer arrives before the click, not as a 400 after it.
  const hasGoal = goal.conditions.length > 0;
  const uncountable = stages.filter((s) => s.kind === 'view' && !s.path && !current.entryPageId);
  const blockedReason = !hasGoal
    ? 'Say what has to happen for this campaign to have worked, below, before you turn it on.'
    : uncountable.length > 0
      ? `Say which page counts as ${uncountable.map((s) => `"${s.name}"`).join(' and ')} before you turn it on.`
      : null;

  const save = () => {
    update.mutate(
      { name, description: description || null, stages, goal: hasGoal ? goal : null },
      { onSuccess: () => toast.add({ title: 'Campaign saved', type: 'success' }) }
    );
  };

  const setRunning = (next: boolean) => {
    update.mutate(
      { status: next ? 'active' : 'paused' },
      {
        onSuccess: () =>
          toast.add({
            title: next ? 'Campaign is running' : 'Campaign paused',
            description: next
              ? 'It is counting people from now on.'
              : 'It keeps everything it has already recorded.',
            type: 'success',
          }),
      }
    );
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${current.name}?`,
      description:
        'This removes the campaign and every number recorded against it. The people it recorded stay in your customer list. This cannot be undone.',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        ctx.close();
        toast.add({ title: `${current.name} deleted`, type: 'success' });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Campaign controls" wrap>
        <Badge color={meta.tone} variant="soft" size="sm">
          {meta.label}
        </Badge>
        <Text className="text-sm">{meta.note}</Text>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit ? (
            <>
              <Button
                size="sm"
                color={running ? 'warning' : 'module'}
                variant={running ? 'outline' : 'solid'}
                disabled={update.isPending || (!running && blockedReason !== null)}
                title={!running && blockedReason ? blockedReason : undefined}
                onClick={() => {
                  setRunning(!running);
                }}
              >
                {running ? (
                  <>
                    <Pause className="size-4" aria-hidden />
                    Pause it
                  </>
                ) : (
                  <>
                    <Play className="size-4" aria-hidden />
                    Turn it on
                  </>
                )}
              </Button>
              <Button
                size="sm"
                color="module"
                disabled={!changed || update.isPending}
                onClick={save}
              >
                Save
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="ghost"
                shape="square"
                aria-label="Delete this campaign"
                onClick={() => {
                  void onDelete();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </>
          ) : null}
        </div>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full flex-col gap-6 p-4">
          {current.status === 'draft' ? (
            <EmptyState
              icon={<Target className="size-6" aria-hidden />}
              title="Nothing recorded yet"
              description="This campaign is a draft, so it is not counting anyone. Set up its steps and say what counts as success, then turn it on."
            />
          ) : (
            <ReportPanel id={id} />
          )}

          <section className="flex flex-col gap-3">
            <Heading level={2} className="text-lg font-semibold">
              Setup
            </Heading>

            <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
              <Field>
                <FieldLabel>Name</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={name}
                      disabled={!canEdit}
                      onChange={(event) => {
                        setName(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
              <Field>
                <FieldLabel>What is it for?</FieldLabel>
                <FieldControl
                  render={
                    <Textarea
                      color="module"
                      rows={2}
                      value={description}
                      disabled={!canEdit}
                      onChange={(event) => {
                        setDescription(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <Heading level={3} className="text-base font-semibold">
                The steps
              </Heading>
              <Text className="text-sm">
                In order, from the first thing somebody does to the outcome you want. Renaming a
                step keeps everything it has already recorded.
              </Text>
              <StageLadderEditor stages={stages} onChange={setStages} disabled={!canEdit} />
            </div>

            <div className="flex flex-col gap-2">
              <Heading level={3} className="text-base font-semibold">
                What counts as success
              </Heading>
              <Text className="text-sm">
                Without this the campaign can only tell you what happened, not whether it worked, so
                it cannot be turned on.
              </Text>
              <ConditionEditor value={goal} onChange={setGoal} label="people" />
            </div>

            {update.isError ? (
              <Text className="text-danger text-sm">
                {funnelErrorMessage(update.error, 'That change could not be saved.')}
              </Text>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export default CampaignSurface;
