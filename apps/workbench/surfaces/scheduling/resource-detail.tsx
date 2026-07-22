'use client';

// ONE RESOURCE — a person, a room, a table, a machine. Set it up, change it,
// switch it off, or remove it.
//
// Create and edit are the SAME surface: `{id:'new'}` renders a blank draft,
// `{id}` renders the same fields hydrated. One centred, capped column — there is
// no running summary to justify EditorLayout.
//
// The capacity question changes shape with the KIND, because "how many at once"
// means different things: a person holds one booking, a table seats a party
// between a minimum and a maximum, a pooled room or machine can take several
// bookings side by side. Only the controls that make sense for the chosen kind
// are shown, so nobody sets a party size on a hairdresser.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { Save, Trash2, Users } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  RESOURCE_KINDS,
  isNotFound,
  resourceKindLabel,
  schedulingErrorMessage,
  resourceState,
  useCreateResource,
  useDeleteResource,
  useResource,
  useUpdateResource,
  type ResourceInput,
  type ResourceKind,
  type SchedulingResource,
} from './setup-data';

const COLUMN = 'mx-auto flex w-full max-w-2xl flex-col gap-4';

const DETAIL_KEY = 'scheduling.resources.detail';

/** A short, familiar set of zones. The engine resolves the hours a resource is
 *  free in ITS zone, so this is the zone the person or place actually works in. */
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

interface Draft {
  name: string;
  kind: ResourceKind;
  description: string;
  timezone: string;
  /** For pooled kinds — several bookings at once. */
  pooled: boolean;
  capacity: number;
  /** Party size, for tables. Strings so an empty field is empty, not a zero. */
  capacityMin: string;
  capacityMax: string;
  /** Comma-separated skills/tags a service can match against. */
  skills: string;
  bookableOnline: boolean;
  isActive: boolean;
}

const BLANK: Draft = {
  name: '',
  kind: 'staff',
  description: '',
  timezone: 'UTC',
  pooled: false,
  capacity: 2,
  capacityMin: '',
  capacityMax: '',
  skills: '',
  bookableOnline: true,
  isActive: true,
};

function draftFrom(resource: SchedulingResource): Draft {
  return {
    name: resource.name,
    kind: resource.kind,
    description: resource.description ?? '',
    timezone: resource.timezone,
    pooled: !resource.exclusive,
    capacity: resource.capacity > 1 ? resource.capacity : 2,
    capacityMin: resource.capacityMin != null ? String(resource.capacityMin) : '',
    capacityMax: resource.capacityMax != null ? String(resource.capacityMax) : '',
    skills: resource.skillTags.join(', '),
    bookableOnline: resource.bookableOnline,
    isActive: resource.isActive,
  };
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function intOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : null;
}

function intOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

/* ── The shared form ────────────────────────────────────────────────────── */

function ResourceEditor({
  ctx,
  id,
  initial,
  existing,
}: {
  ctx: SurfaceContext;
  id: string;
  initial: Draft;
  existing: SchedulingResource | null;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = id === 'new';

  const create = useCreateResource();
  const update = useUpdateResource(id);
  const remove = useDeleteResource(id);

  const [draft, setDraft] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    ctx.setTitle(isNew ? 'New resource' : draft.name.trim() || 'Resource');
  }, [ctx, isNew, draft.name]);

  const nameOk = draft.name.trim() !== '';
  const changed = useMemo(() => !draftsEqual(draft, initial), [draft, initial]);
  const busy = create.isPending || update.isPending;
  const canSave = nameOk && changed && !busy;

  useDirtySource(
    changed && !create.isSuccess,
    isNew
      ? 'This new entry has not been saved yet. Close anyway?'
      : `${initial.name || 'This entry'} has unsaved changes. Close anyway?`
  );

  const saveError =
    create.isError || update.isError
      ? schedulingErrorMessage(
          create.error ?? update.error,
          'Nothing was saved. Try again in a moment.'
        )
      : null;

  const isTable = draft.kind === 'table';
  const canPool = draft.kind === 'space' || draft.kind === 'equipment' || draft.kind === 'asset';

  const payload = (): ResourceInput => {
    const pooled = canPool && draft.pooled;
    return {
      name: draft.name.trim(),
      kind: draft.kind,
      description: draft.description.trim() === '' ? null : draft.description.trim(),
      timezone: draft.timezone,
      // Tables and non-pooled resources hold ONE booking at a time (exclusive);
      // a pooled room or machine can take several side by side.
      exclusive: !pooled,
      capacity: pooled ? Math.max(2, draft.capacity) : 1,
      capacityMin: isTable ? intOrNull(draft.capacityMin) : null,
      capacityMax: isTable ? intOrNull(draft.capacityMax) : null,
      skillTags: parseSkills(draft.skills),
      bookableOnline: draft.bookableOnline,
      isActive: draft.isActive,
    };
  };

  const submit = () => {
    if (!canSave) return;
    const body = payload();
    if (isNew) {
      create.mutate(body, {
        onSuccess: (row) => {
          ctx.open(DETAIL_KEY, { id: row.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${body.name ?? 'Entry'} added`, type: 'success' });
          });
        },
      });
      return;
    }
    update.mutate(body, {
      onSuccess: () => {
        toast.add({ title: 'Saved', type: 'success' });
      },
    });
  };

  const onRemove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Remove ${existing.name}?`,
      description:
        'This takes it out of your list and off any service that used it. Bookings already made are kept. This cannot be undone.',
      confirmLabel: 'Remove it',
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
          title: 'Could not remove this',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const state = existing ? resourceState(existing) : null;
  const kindHint = RESOURCE_KINDS.find((k) => k.value === draft.kind)?.hint;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label={isNew ? 'New resource actions' : 'Resource actions'}>
        {state ? (
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        ) : null}
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          disabled={!canSave}
          loading={busy}
          onClick={submit}
        >
          <Save className="size-4" aria-hidden />
          {isNew ? 'Create' : 'Save'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {existing ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="flex min-w-0 items-center gap-2 text-2xl font-semibold">
                <Users className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">{existing.name}</span>
              </Heading>
              <Text className="text-sm">{resourceKindLabel(existing.kind)}</Text>
            </div>
          ) : null}

          {saveError ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not save this</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection
            title={isNew ? 'New person or thing' : 'What it is'}
            description={
              isNew
                ? 'Say what kind of thing this is and give it a name your team will recognise.'
                : undefined
            }
          >
            <Field>
              <FieldLabel>What is it</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    value={draft.kind}
                    aria-label="What kind of thing"
                    onChange={(event) => {
                      set('kind', event.target.value as ResourceKind);
                    }}
                  >
                    {RESOURCE_KINDS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                }
              />
              {kindHint ? <FieldDescription>{kindHint}</FieldDescription> : null}
            </Field>

            <Field>
              <FieldLabel>Name</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={draft.name}
                    placeholder={draft.kind === 'staff' ? 'Alex Rivera' : 'Treatment room 1'}
                    onChange={(event) => {
                      set('name', event.target.value);
                    }}
                  />
                }
              />
            </Field>

            <Field>
              <FieldLabel>Notes (optional)</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={2}
                    value={draft.description}
                    placeholder="Anything worth noting — a speciality, a location, a quirk."
                    onChange={(event) => {
                      set('description', event.target.value);
                    }}
                  />
                }
              />
            </Field>

            <Field>
              <FieldLabel>Time zone</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    className="max-w-sm"
                    value={draft.timezone}
                    aria-label="Time zone"
                    onChange={(event) => {
                      set('timezone', event.target.value);
                    }}
                  >
                    {TIMEZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </NativeSelect>
                }
              />
              <FieldDescription>
                The zone this works in — the hours you set are read in this time.
              </FieldDescription>
            </Field>
          </FormSection>

          <FormSection
            title="How many at once"
            description="Whether two bookings can ever share this at the same time."
          >
            {isTable ? (
              <div className="grid gap-4 @md:grid-cols-2">
                <Field>
                  <FieldLabel>Smallest party</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        color="module"
                        type="number"
                        min={1}
                        className="max-w-28 tabular-nums"
                        value={draft.capacityMin}
                        placeholder="2"
                        onChange={(event) => {
                          set('capacityMin', event.target.value);
                        }}
                      />
                    }
                  />
                  <FieldDescription>The fewest people it is worth seating here.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Largest party</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        color="module"
                        type="number"
                        min={1}
                        className="max-w-28 tabular-nums"
                        value={draft.capacityMax}
                        placeholder="4"
                        onChange={(event) => {
                          set('capacityMax', event.target.value);
                        }}
                      />
                    }
                  />
                  <FieldDescription>The most people it can seat.</FieldDescription>
                </Field>
              </div>
            ) : canPool ? (
              <>
                <label className="flex items-start gap-3">
                  <Checkbox
                    color="module"
                    checked={draft.pooled}
                    aria-label="More than one booking can use this at the same time"
                    onChange={(event) => {
                      set('pooled', event.target.checked);
                    }}
                  />
                  <span className="flex flex-col gap-0.5">
                    <Text as="span" className="font-medium">
                      More than one booking can use this at the same time
                    </Text>
                    <Text as="span" className="text-sm">
                      Leave off for something only one booking can have at once. Turn it on for a
                      shared space or a set of identical items.
                    </Text>
                  </span>
                </label>

                {draft.pooled ? (
                  <Field>
                    <FieldLabel>How many at the same time</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          type="number"
                          min={2}
                          className="max-w-28 tabular-nums"
                          value={String(draft.capacity)}
                          onChange={(event) => {
                            set('capacity', intOr(Number(event.target.value), 2));
                          }}
                        />
                      }
                    />
                    <FieldDescription>
                      How many bookings can share this at once before it is full.
                    </FieldDescription>
                  </Field>
                ) : null}
              </>
            ) : (
              <Text className="text-sm">
                A person holds one booking at a time — that is what stops them being double-booked.
              </Text>
            )}
          </FormSection>

          <FormSection
            title="Skills & matching"
            description="Words a service can look for when it needs a particular skill or feature — “colour”, “senior”, “wheelchair access”. A service that asks for a skill is only offered the people or things that carry it."
          >
            <Field>
              <FieldLabel>Skills or features (optional)</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={draft.skills}
                    placeholder="colour, senior, treatment"
                    onChange={(event) => {
                      set('skills', event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>Separate each one with a comma.</FieldDescription>
            </Field>
          </FormSection>

          <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
            <label className="flex items-start gap-3">
              <Checkbox
                color="module"
                checked={draft.bookableOnline}
                aria-label="Customers can be booked onto this online"
                onChange={(event) => {
                  set('bookableOnline', event.target.checked);
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span" className="font-medium">
                  Customers can be booked onto this online
                </Text>
                <Text as="span" className="text-sm">
                  Off, only your team can assign bookings to it — it never shows on your public
                  booking page.
                </Text>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <Checkbox
                color="module"
                checked={draft.isActive}
                aria-label="This is in use"
                onChange={(event) => {
                  set('isActive', event.target.checked);
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span" className="font-medium">
                  This is in use
                </Text>
                <Text as="span" className="text-sm">
                  Switch it off to take it out of the picture — on holiday, out of action — without
                  removing it. Turn it back on any time.
                </Text>
              </span>
            </label>

            {existing ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text className="text-sm">
                  Removing this takes it off every service that used it. Bookings already made are
                  kept.
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
                  <Trash2 className="size-4" aria-hidden />
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

export function ResourceDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';
  const resource = useResource(id);

  if (isNew) {
    return <ResourceEditor ctx={ctx} id="new" initial={BLANK} existing={null} />;
  }

  if (resource.isError) {
    const gone = isNotFound(resource.error);
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <Alert color={gone ? 'warning' : 'error'} variant="soft" className="max-w-md">
            <AlertContent>
              <AlertTitle>{gone ? 'This no longer exists' : 'Could not load this'}</AlertTitle>
              <AlertDescription>
                {gone
                  ? 'It has been removed. Any bookings already made against it are unaffected.'
                  : 'This is a problem reaching the server. Nothing has changed.'}
              </AlertDescription>
            </AlertContent>
            {gone ? null : (
              <Button
                size="sm"
                color="error"
                variant="soft"
                onClick={() => {
                  void resource.refetch();
                }}
              >
                Try again
              </Button>
            )}
          </Alert>
        </div>
      </div>
    );
  }

  if (resource.isPending || !resource.data) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <ResourceEditor
      key={resource.data.id}
      ctx={ctx}
      id={id}
      initial={draftFrom(resource.data)}
      existing={resource.data}
    />
  );
}
