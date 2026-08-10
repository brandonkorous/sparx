'use client';

// One support request — open it, then work it (docs/144 §7).
//
// Add and manage are the SAME surface: `{ id: 'new' }` files a request, `{ id }`
// works one. The subject is an editable field, not a repeated heading, and the
// two things that decide what happens next — where it is in the process, and how
// much time is left — live in the toolbar where they are visible without
// scrolling.
//
// MOVING IT ALONG IS ITS OWN ACTION, not a dropdown inside the form. That
// transition stamps resolved/closed, writes the timeline entry, and fires the
// event every rule the business has set up hangs off — so it must not be
// something that happens as a side effect of pressing Save on a subject edit.
//
// THE CLOCKS COME DOWN ALREADY WORKED OUT. "80% of four working hours, in the
// business's own timezone, skipping the days it is shut" is arithmetic the
// server owns; this surface only chooses the colour.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { LifeBuoy } from 'lucide-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useTeamRoster } from '../../lib/api/team';
import { customerName, useCustomers } from './customers-data';
import { EngagementComposer } from './engagement-composer';
import { usePipelines } from './pipelines-data';
import {
  priorityLabel,
  priorityTone,
  remainingLabel,
  slaTone,
  sourceLabel,
  targetLabel,
  ticketErrorMessage,
  useAssignTicket,
  useCreateTicket,
  useMoveTicketStage,
  useSlaPolicies,
  useTicket,
  useUpdateTicket,
  type SlaClock,
  type TicketInput,
  type TicketPriority,
  type TicketView,
} from './tickets-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

/* ── Draft ──────────────────────────────────────────────────────────────── */

interface Draft {
  subject: string;
  description: string;
  priority: TicketPriority;
  customerId: string;
  tags: string;
}

function emptyDraft(): Draft {
  return { subject: '', description: '', priority: 'medium', customerId: '', tags: '' };
}

function toDraft(view: TicketView): Draft {
  return {
    subject: view.ticket.subject,
    description: view.ticket.description ?? '',
    priority: view.ticket.priority,
    customerId: view.ticket.customerId ?? '',
    tags: view.ticket.tags.join(', '),
  };
}

/* ── One clock, said plainly ────────────────────────────────────────────── */

function ClockLine({ label, clock, kept }: { label: string; clock: SlaClock; kept: string }) {
  if (clock.state === 'none') {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <Text>{label}</Text>
        <Text>No target set</Text>
      </div>
    );
  }
  const due = clock.dueAt
    ? new Date(clock.dueAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Text>{label}</Text>
      <span className="flex items-center gap-2">
        {due ? <Text>by {due}</Text> : null}
        <Badge color={slaTone(clock.state)} variant="soft" size="sm">
          {clock.state === 'met' ? kept : (remainingLabel(clock.minutesRemaining) ?? 'Running')}
        </Badge>
      </span>
    </div>
  );
}

/* ── Surface ────────────────────────────────────────────────────────────── */

export function TicketDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <TicketEditor ctx={ctx} id="new" /> : <TicketLoader ctx={ctx} id={id} />;
}

function TicketLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data: view, isPending, isError, refetch } = useTicket(id);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load this request</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server, or the request has been removed. Nothing has
              been changed.
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

  if (isPending || !view) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return <TicketEditor ctx={ctx} id={id} view={view} />;
}

function TicketEditor({ ctx, id, view }: { ctx: SurfaceContext; id: string; view?: TicketView }) {
  const isNew = id === 'new';
  const toast = useToast();

  const create = useCreateTicket();
  const update = useUpdateTicket(id);
  const moveStage = useMoveTicketStage(id);
  const assign = useAssignTicket(id);

  const { members: roster } = useTeamRoster();
  const { data: customers } = useCustomers({});
  const { data: policies } = useSlaPolicies();
  // The support queue's own stages. `objectKey: 'ticket'` matters: without it
  // this picker would offer the SALES pipeline's stages, and a request could be
  // moved to "Closed Won".
  const { data: pipelines } = usePipelines({ objectKey: 'ticket' });

  const saved = useMemo(() => (view ? toDraft(view) : emptyDraft()), [view]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  // Opened from a customer's profile ("New request") — the id rides in on
  // ctx.params and seeds the form while it is still untouched, so it reads as a
  // starting point rather than an unsaved edit.
  const presetCustomerId = typeof ctx.params.customerId === 'string' ? ctx.params.customerId : '';
  useEffect(() => {
    if (!isNew || touched || presetCustomerId === '') return;
    setDraft((cur) => ({ ...cur, customerId: presetCustomerId }));
  }, [isNew, touched, presetCustomerId]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New request' : view ? `#${String(view.ticket.number)}` : 'Request');
  }, [ctx, isNew, view]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty = touched && JSON.stringify(draft) !== JSON.stringify(saved);
  const saving = create.isPending || update.isPending;

  useDirtySource(
    dirty && !create.isSuccess,
    isNew
      ? 'This request has not been opened yet. Close anyway?'
      : 'This request has unsaved changes. Close anyway?'
  );

  const customerItems = useMemo(() => {
    const items: Record<string, string> = { '': 'Not linked to anyone on file' };
    for (const c of customers?.items ?? []) items[c.id] = customerName(c);
    if (draft.customerId && !items[draft.customerId])
      items[draft.customerId] = 'A removed customer';
    return items;
  }, [customers, draft.customerId]);

  const assigneeItems = useMemo(() => {
    const items: Record<string, string> = { '': 'Nobody yet' };
    for (const m of roster) items[m.userId] = m.name ?? m.email;
    const current = view?.ticket.assignedToUserId;
    if (current && !items[current]) items[current] = 'A former team member';
    return items;
  }, [roster, view]);

  const stages = useMemo(() => {
    const own = pipelines?.items.find((p) => p.id === view?.ticket.pipelineId);
    return own?.stages ?? [];
  }, [pipelines, view]);

  const stageItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const s of stages) items[s.id] = s.name;
    return items;
  }, [stages]);

  /* ── Validation ───────────────────────────────────────────────────────── */

  const subjectError = draft.subject.trim() === '' ? 'Say what the request is about.' : null;

  const failure =
    create.isError || update.isError
      ? ticketErrorMessage(
          create.error ?? update.error,
          'Could not save this request. Nothing was changed.'
        )
      : null;

  /* ── Submit ───────────────────────────────────────────────────────────── */

  const tagList = () =>
    draft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const submit = () => {
    if (subjectError) return;
    const base: Partial<TicketInput> = {
      subject: draft.subject.trim(),
      description: draft.description.trim() === '' ? null : draft.description.trim(),
      priority: draft.priority,
      customerId: draft.customerId || null,
      tags: tagList(),
    };

    if (isNew) {
      create.mutate(
        { ...base, subject: draft.subject.trim(), source: 'manual' },
        {
          onSuccess: (created) => {
            ctx.open('crm.ticket.detail', { id: created.ticket.id }, { target: 'replace' });
            afterPaneChange(() => {
              toast.add({
                title: `Request #${String(created.ticket.number)} opened`,
                type: 'success',
              });
            });
          },
        }
      );
      return;
    }

    update.mutate(base, {
      onSuccess: () => {
        setTouched(false);
        toast.add({ title: 'Request saved', type: 'success' });
      },
    });
  };

  const onMove = (toStageId: string) => {
    const target = stages.find((s) => s.id === toStageId);
    moveStage.mutate(
      { toStageId },
      {
        onSuccess: () => {
          toast.add({
            title:
              target && (target.stageType === 'resolved' || target.stageType === 'closed')
                ? 'Marked as sorted — the customer’s clock stops here'
                : `Moved to ${target?.name ?? 'the next stage'}`,
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not move it',
            description: ticketErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const policy = policies?.items.find((p) => p.id === view?.ticket.slaPolicyId);
  const target = policy?.targets.find((t) => t.priority === (view?.ticket.priority ?? 'medium'));

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Request actions">
        {view ? (
          <>
            <Badge color={priorityTone(view.ticket.priority)} variant="soft" size="sm">
              {priorityLabel(view.ticket.priority)}
            </Badge>
            {view.firstResponse.state !== 'none' ? (
              <Badge
                color={slaTone(view.firstResponse.state)}
                variant="soft"
                size="sm"
                title="How long is left to reply for the first time"
              >
                {view.firstResponse.state === 'met'
                  ? 'Replied'
                  : (remainingLabel(view.firstResponse.minutesRemaining) ?? 'Reply due')}
              </Badge>
            ) : null}
            {view.resolution.state !== 'none' ? (
              <Badge
                color={slaTone(view.resolution.state)}
                variant="soft"
                size="sm"
                title="How long is left to have it sorted"
              >
                {view.resolution.state === 'met'
                  ? 'Sorted'
                  : (remainingLabel(view.resolution.minutesRemaining) ?? 'Resolution due')}
              </Badge>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="w-44">
                <Select
                  size="sm"
                  color="module"
                  aria-label="Which stage this request is on"
                  value={view.ticket.stageId}
                  items={stageItems}
                  disabled={moveStage.isPending || Object.keys(stageItems).length === 0}
                  onValueChange={(next) => {
                    if (next !== view.ticket.stageId) onMove(next as string);
                  }}
                />
              </div>
              <div className="hidden w-44 @xl:block">
                <Select
                  size="sm"
                  aria-label="Who owns this request"
                  value={view.ticket.assignedToUserId ?? ''}
                  items={assigneeItems}
                  disabled={assign.isPending}
                  onValueChange={(next) => {
                    assign.mutate((next as string) || null);
                  }}
                />
              </div>
            </div>
          </>
        ) : null}
        <Button
          color="module"
          size="sm"
          className={view ? 'shrink-0' : 'ml-auto shrink-0'}
          loading={saving}
          disabled={Boolean(subjectError) || (!isNew && !dirty)}
          onClick={submit}
        >
          {isNew ? 'Open request' : 'Save'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Open a support request
              </Heading>
              <Text>
                Use this for something a customer has asked for that somebody still owes them an
                answer on. Requests from your website forms, live chat and email arrive here on
                their own — this is for the ones that came in another way.
              </Text>
            </div>
          ) : null}

          {failure ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not save this request</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection title="The request">
            <Field>
              <FieldLabel>What they asked for</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color={subjectError && touched ? 'error' : 'module'}
                    value={draft.subject}
                    placeholder="Replacement part arrived damaged"
                    onChange={(event) => {
                      set('subject', event.target.value);
                    }}
                  />
                }
              />
              {subjectError && touched ? (
                <FieldStatus status="error">{subjectError}</FieldStatus>
              ) : null}
            </Field>

            <Field>
              <FieldLabel>Detail</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={4}
                    value={draft.description}
                    placeholder="What happened, in their words if you have them."
                    onChange={(event) => {
                      set('description', event.target.value);
                    }}
                  />
                }
              />
            </Field>

            <div className="grid gap-3 @md:grid-cols-2">
              <Field>
                <FieldLabel>How urgent</FieldLabel>
                <Select
                  color="module"
                  aria-label="How urgent this is"
                  value={draft.priority}
                  items={Object.fromEntries(PRIORITIES.map((p) => [p, priorityLabel(p)]))}
                  onValueChange={(next) => {
                    set('priority', next as TicketPriority);
                  }}
                />
                <FieldDescription>
                  This decides how quickly you have promised to reply. Changing it moves the
                  deadline, counted from when the request first came in.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Who asked</FieldLabel>
                <Select
                  color="module"
                  aria-label="Which customer asked"
                  value={draft.customerId}
                  items={customerItems}
                  onValueChange={(next) => {
                    set('customerId', next as string);
                  }}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Labels</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={draft.tags}
                    placeholder="warranty, shipping"
                    onChange={(event) => {
                      set('tags', event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>
                Your own words for sorting these later, separated by commas.
              </FieldDescription>
            </Field>
          </FormSection>

          {view ? (
            <FormSection
              title="The clock"
              description="What this business promised, and where this request stands against it."
            >
              <Card className="flex flex-col gap-2 p-4">
                <ClockLine label="First reply" clock={view.firstResponse} kept="Replied" />
                <ClockLine label="Sorted out" clock={view.resolution} kept="Sorted" />
                {policy ? (
                  <Text>
                    Measured against “{policy.name}” —{' '}
                    {targetLabel(target?.firstResponseMinutes ?? null) ?? 'no reply target'} to
                    reply,{' '}
                    {targetLabel(target?.resolutionMinutes ?? null) ?? 'no resolution target'} to
                    sort out, counted only during the hours you are open.
                  </Text>
                ) : (
                  <Text>
                    No response promise is attached to this request, so nothing here is measured
                    against a deadline.
                  </Text>
                )}
              </Card>
            </FormSection>
          ) : null}

          {view ? (
            <FormSection
              title="Where it came from"
              description="How this request reached you, and when."
            >
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <Text>Came in by</Text>
                  <Text>{sourceLabel(view.ticket.source)}</Text>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <Text>Opened</Text>
                  <Text>{new Date(view.ticket.createdAt).toLocaleString()}</Text>
                </div>
                {view.ticket.company ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <Text>Trade account</Text>
                    <Text>{view.ticket.company.name}</Text>
                  </div>
                ) : null}
              </Card>
            </FormSection>
          ) : null}

          {view?.ticket.customerId ? (
            <FormSection
              title="The conversation"
              description="Anything you send from here is filed against this request — which is also what records that you replied."
            >
              <EngagementComposer
                customerId={view.ticket.customerId}
                ticketId={view.ticket.id}
                canEmail={Boolean(view.ticket.customer?.email)}
              />
            </FormSection>
          ) : view ? (
            <Alert color="info" variant="soft">
              <AlertContent>
                <AlertTitle>Nobody is linked to this request</AlertTitle>
                <AlertDescription>
                  Link a customer above and you can reply from here — and replying is what records
                  that this request has been answered.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {isNew ? (
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-4" aria-hidden />
              <Text>
                A reply deadline is attached automatically, based on the hours you work and how
                urgent this is.
              </Text>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
