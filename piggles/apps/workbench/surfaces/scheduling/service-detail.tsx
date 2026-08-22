'use client';

// ONE SERVICE — set it up, change it, switch it off, or remove it.
//
// Create and edit are the SAME surface. A new service and an existing one are the
// same object at two ages, and the form is identical either way — so this is one
// pane in two states: `{id:'new'}` renders a blank draft, `{id}` renders the same
// fields hydrated. Splitting them is how a field ends up owned by two components.
//
// Not EditorLayout: there is no running summary to put beside the fields, so a
// summary rail would float half-empty. One centred, capped column instead.
//
// Removing a service is rare and hard to undo, so it sits at the bottom under a
// divider — a quiet row after the work, never a card competing with the fields.

import { useEffect, useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { faFloppyDisk, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { ServiceRequirements } from './service-requirements';
import { ServiceBasics } from './service-basics';
import { moneyCents, moneyProblem } from '../../components/money-input';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  bookingTypeLabel,
  isNotFound,
  schedulingErrorMessage,
  serviceState,
  useCreateService,
  useDeleteService,
  usePolicies,
  useService,
  useUpdateService,
  type AssignmentStrategy,
  type BookingType,
  type ResourceRequirement,
  type SchedulingService,
} from './setup-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

const DETAIL_KEY = 'scheduling.services.detail';

/** The currencies offered, lowercase to match the 3-char ISO the service stores. */
export const CURRENCIES = ['usd', 'cad', 'eur', 'gbp', 'aud', 'nzd', 'jpy'] as const;

export interface Draft {
  name: string;
  description: string;
  bookingType: BookingType;
  durationMinutes: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  slotIntervalMin: number;
  price: string;
  currency: string;
  capacity: number;
  policyId: string;
  assignmentStrategy: AssignmentStrategy;
  requirements: ResourceRequirement[];
  minLeadMinutes: number;
  maxAdvanceDays: number;
  bookableOnline: boolean;
  requiresApproval: boolean;
  requiresAsset: boolean;
  isActive: boolean;
}

const BLANK: Draft = {
  name: '',
  description: '',
  bookingType: 'appointment',
  durationMinutes: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  slotIntervalMin: 15,
  price: '',
  currency: 'usd',
  capacity: 1,
  policyId: '',
  assignmentStrategy: 'any_available',
  requirements: [],
  minLeadMinutes: 0,
  maxAdvanceDays: 365,
  bookableOnline: true,
  requiresApproval: false,
  requiresAsset: false,
  isActive: true,
};

function centsToPrice(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : '';
}

/** A typed price → integer cents, or null when it cannot be read. Blank is
 *  free; "65,00" is sixty-five dollars, not six thousand five hundred, and
 *  anything genuinely unreadable is refused rather than saved as free (086). */
function priceToCents(value: string): number | null {
  return moneyCents(value);
}

function draftFrom(service: SchedulingService): Draft {
  return {
    name: service.name,
    description: service.description ?? '',
    bookingType: service.bookingType,
    durationMinutes: service.durationMinutes,
    bufferBeforeMin: service.bufferBeforeMin,
    bufferAfterMin: service.bufferAfterMin,
    slotIntervalMin: service.slotIntervalMin,
    price: centsToPrice(service.priceCents),
    currency: service.currency,
    capacity: service.capacity,
    policyId: service.policyId ?? '',
    assignmentStrategy: service.assignmentStrategy,
    // Field by field, NOT a spread. `draftsEqual` compares stringified drafts,
    // which is key-ORDER sensitive, and the server returns these keys in a
    // different order from the one the form builds them in — so a spread left
    // the pane permanently "not saved" after a save that worked (issue 087).
    requirements: service.resourceRequirements.map((requirement) => ({
      role: requirement.role,
      kind: requirement.kind,
      skillTags: [...requirement.skillTags],
      count: requirement.count,
    })),
    minLeadMinutes: service.minLeadMinutes,
    maxAdvanceDays: service.maxAdvanceDays,
    bookableOnline: service.bookableOnline,
    requiresApproval: service.requiresApproval,
    requiresAsset: service.requiresAsset,
    isActive: service.isActive,
  };
}

/** A whole-object comparison — the requirements are an array, so a field-by-field
 *  check would miss a reorder or a tag edit. */
function draftsEqual(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A non-negative integer from a number input, falling back when it is cleared. */
function intOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/* ── The shared form ────────────────────────────────────────────────────── */

function ServiceEditor({
  ctx,
  id,
  initial,
  existing,
  isFetching = false,
  updatedAt,
  onRefresh,
}: {
  ctx: SurfaceContext;
  id: string;
  initial: Draft;
  existing: SchedulingService | null;
  /** Absent on a brand-new service — there is nothing loaded to re-read. */
  isFetching?: boolean;
  updatedAt?: number;
  onRefresh?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = id === 'new';

  const create = useCreateService();
  const update = useUpdateService(id);
  const remove = useDeleteService(id);
  const policies = usePolicies({ take: 250, skip: 0 });

  const [draft, setDraft] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    ctx.setTitle(isNew ? 'New service' : draft.name.trim() || 'Service');
  }, [ctx, isNew, draft.name]);

  const nameOk = draft.name.trim() !== '';
  const durationOk = draft.durationMinutes >= 1;
  // A price nobody can read must not be saved as free (086) — the field says
  // what is wrong and Save waits until it is.
  const priceProblem = moneyProblem(draft.price);
  const changed = useMemo(() => !draftsEqual(draft, initial), [draft, initial]);
  const busy = create.isPending || update.isPending;
  const canSave = nameOk && durationOk && priceProblem === null && changed && !busy;

  useDirtySource(
    changed && !create.isSuccess,
    isNew
      ? 'This new service has not been saved yet. Close anyway?'
      : `${initial.name || 'This service'} has unsaved changes. Close anyway?`
  );

  const saveError =
    create.isError || update.isError
      ? schedulingErrorMessage(
          create.error ?? update.error,
          'Nothing was saved. Try again in a moment.'
        )
      : null;

  /** The full object every write sends — the create route fills defaults, and the
   *  edit route replaces the whole service, so sending it whole keeps the two
   *  paths identical rather than diffing. */
  const payload = () => ({
    name: draft.name.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    bookingType: draft.bookingType,
    durationMinutes: draft.durationMinutes,
    bufferBeforeMin: draft.bufferBeforeMin,
    bufferAfterMin: draft.bufferAfterMin,
    slotIntervalMin: Math.max(1, draft.slotIntervalMin),
    // `canSave` already refused an unreadable price, so the null branch is a
    // belt-and-braces zero rather than a decision.
    priceCents: priceToCents(draft.price) ?? 0,
    currency: draft.currency,
    capacity: draft.bookingType === 'class' ? Math.max(1, draft.capacity) : 1,
    policyId: draft.policyId === '' ? null : draft.policyId,
    assignmentStrategy: draft.assignmentStrategy,
    resourceRequirements: draft.requirements.map((requirement) => ({
      role: requirement.role.trim(),
      kind: requirement.kind,
      skillTags: requirement.skillTags.map((tag) => tag.trim()).filter(Boolean),
      count: Math.max(1, requirement.count),
    })),
    minLeadMinutes: draft.minLeadMinutes,
    maxAdvanceDays: draft.maxAdvanceDays,
    bookableOnline: draft.bookableOnline,
    requiresApproval: draft.requiresApproval,
    requiresAsset: draft.requiresAsset,
    isActive: draft.isActive,
  });

  const submit = () => {
    if (!canSave) return;
    // A requirement with no role name can't be matched — drop the empties rather
    // than let the server reject the whole save.
    const body = payload();
    body.resourceRequirements = body.resourceRequirements.filter((r) => r.role !== '');

    if (isNew) {
      create.mutate(body, {
        onSuccess: (row) => {
          ctx.open(DETAIL_KEY, { id: row.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${body.name} added`, type: 'success' });
          });
        },
      });
      return;
    }

    update.mutate(body, {
      onSuccess: () => {
        toast.add({ title: 'Service saved', type: 'success' });
      },
    });
  };

  const onRemove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Remove ${existing.name}?`,
      description:
        'This takes the service off your booking page and out of this list. Bookings already made against it are kept. This cannot be undone — you would have to set it up again.',
      confirmLabel: 'Remove this service',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${existing.name} removed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this service',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const state = existing ? serviceState(existing) : null;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label={isNew ? 'New service actions' : 'Service actions'}
        refresh={
          onRefresh ? (
            <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
          ) : undefined
        }
        status={
          state ? (
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
          ) : null
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            disabled={!canSave}
            loading={busy}
            onClick={submit}
          >
            <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
            {isNew ? 'Create service' : 'Save'}
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {existing ? (
            <Text className="text-sm">{bookingTypeLabel(existing.bookingType)}</Text>
          ) : null}

          {saveError ? (
            <Alert color="error">
              <AlertContent>
                <AlertTitle>Could not save this service</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <ServiceBasics
            isNew={isNew}
            draft={draft}
            policies={policies}
            priceProblem={priceProblem}
            onSet={set}
          />

          <ServiceRequirements
            requirements={draft.requirements}
            strategy={draft.assignmentStrategy}
            onChangeStrategy={(strategy) => {
              set('assignmentStrategy', strategy);
            }}
            onChange={(requirements) => {
              set('requirements', requirements);
            }}
          />

          <FormSection title="Booking window">
            <div className="grid gap-4 @md:grid-cols-2">
              <Field>
                <FieldLabel>Least notice needed (minutes)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={0}
                      className="max-w-32 tabular-nums"
                      value={String(draft.minLeadMinutes)}
                      onChange={(event) => {
                        set('minLeadMinutes', intOr(Number(event.target.value), 0));
                      }}
                    />
                  }
                />
                <FieldDescription>
                  How far ahead a customer must book. 0 lets them book right up to the start.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>How far ahead people can book (days)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={0}
                      className="max-w-32 tabular-nums"
                      value={String(draft.maxAdvanceDays)}
                      onChange={(event) => {
                        set('maxAdvanceDays', intOr(Number(event.target.value), 365));
                      }}
                    />
                  }
                />
                <FieldDescription>
                  The furthest into the future a booking can be made.
                </FieldDescription>
              </Field>
            </div>
          </FormSection>

          {/* Quiet option rows and the remove action, after the work — never a
              card competing with the fields someone came to change. */}
          <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
            <label className="flex items-start gap-3">
              <Checkbox
                color="module"
                checked={draft.bookableOnline}
                aria-label="Customers can book this themselves online"
                onChange={(event) => {
                  set('bookableOnline', event.target.checked);
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span" className="font-medium">
                  Customers can book this themselves online
                </Text>
                <Text as="span" className="text-sm">
                  Off, only your team can add this booking — it never appears on your public booking
                  page.
                </Text>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <Checkbox
                color="module"
                checked={draft.requiresApproval}
                aria-label="You approve each booking before it is confirmed"
                onChange={(event) => {
                  set('requiresApproval', event.target.checked);
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span" className="font-medium">
                  You approve each booking before it is confirmed
                </Text>
                <Text as="span" className="text-sm">
                  Bookings come in as requests for you to accept, rather than being confirmed on the
                  spot.
                </Text>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <Checkbox
                color="module"
                checked={draft.requiresAsset}
                aria-label="This booking is about a specific item the customer names"
                onChange={(event) => {
                  set('requiresAsset', event.target.checked);
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span" className="font-medium">
                  The customer names a specific item when booking
                </Text>
                <Text as="span" className="text-sm">
                  For work done on a customer’s own thing — their vehicle, their bike, their
                  instrument. They tell you which one when they book.
                </Text>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <Checkbox
                color="module"
                checked={draft.isActive}
                aria-label="This service is switched on"
                onChange={(event) => {
                  set('isActive', event.target.checked);
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span" className="font-medium">
                  This service is switched on
                </Text>
                <Text as="span" className="text-sm">
                  Switch it off to stop taking bookings for it without removing it — turn it back on
                  any time.
                </Text>
              </span>
            </label>

            {existing ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text className="text-sm">
                  Removing this service takes it off your booking page for good. Bookings already
                  made against it are kept.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  color="danger"
                  disabled={remove.isPending}
                  onClick={() => {
                    void onRemove();
                  }}
                >
                  <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                  {remove.isPending ? 'Removing…' : 'Remove'}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The pane ───────────────────────────────────────────────────────────── */

export function ServiceDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';
  const service = useService(id);

  if (isNew) {
    return <ServiceEditor ctx={ctx} id="new" initial={BLANK} existing={null} />;
  }

  if (service.isError) {
    const gone = isNotFound(service.error);
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            reason={gone ? 'missing' : 'unreachable'}
            title={gone ? 'This service no longer exists' : 'Could not load this service'}
            description={
              gone
                ? 'It has been removed. Any bookings already made against it are unaffected.'
                : 'This is a problem reaching the server. Nothing about the service has changed.'
            }
            onRetry={() => {
              void service.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (service.isPending || !service.data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <ServiceEditor
      key={service.data.id}
      ctx={ctx}
      id={id}
      initial={draftFrom(service.data)}
      existing={service.data}
      isFetching={service.isFetching}
      updatedAt={service.dataUpdatedAt}
      onRefresh={() => {
        void service.refetch();
      }}
    />
  );
}
