'use client';

// STARTING A COUNT — the {id:'new'} state of the count pane.
//
// A new count IS the count surface started empty. Starting one is real work with
// a durable result you come back to, so it is a pane rather than a modal, and on
// creation the pane REPLACES itself with the managed view of the count that now
// exists rather than leaving a spent form beside a list that has moved on.
//
// ── Say what the list will actually contain ──────────────────────────────
//
// "Everything kept at this location" used to promise "every item with stock here
// is listed for you to count, ready to go", and the toast after starting said
// "Every item kept here is ready to count." Both are true of an established
// shop and false of a new one: a shop that has never counted anything has no
// stock rows anywhere, so the list comes up empty under a sentence saying it is
// full (issue 173). Both now describe what is there.

import { useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faClipboardCheck, faWarehouse } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural, useStockLocations } from './data';
import { countErrorMessage, useCreateCount, type CountDetail, type CountType } from './counts-data';
import { COLUMN } from './count-shared';

/** What the count actually came up with, rather than what we hoped it would. */
function startedDescription(created: CountDetail): string {
  if (created.lines.length > 0) {
    return `${plural(created.lines.length, 'item is', 'items are')} ready to count.`;
  }
  return 'Nothing has been counted here before, so the list starts empty — scan or type a code to put the first item on it.';
}

export function StartCount({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const locationsQuery = useStockLocations();
  const create = useCreateCount();

  const locations = (locationsQuery.data?.items ?? []).filter((location) => location.isActive);

  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState<CountType>('full');
  const [note, setNote] = useState('');

  useEffect(() => {
    ctx.setTitle('New count');
  }, [ctx]);

  const touched = warehouseId !== '' || note.trim() !== '';
  useDirtySource(
    touched && !create.isSuccess,
    'This count has not been started yet. Close anyway?'
  );

  const locationName = locations.find((location) => location.id === warehouseId)?.name ?? '';

  const submit = () => {
    if (warehouseId === '') return;
    create.mutate(
      { warehouseId, type, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: (created) => {
          // Become the managed view of the count that now exists. The toast
          // follows the swap rather than sharing its commit — see afterPaneChange.
          ctx.open('inventory.counts.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({
              title: `Count started at ${locationName}`,
              description: startedDescription(created),
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not start the count',
            description: countErrorMessage(error, 'Nothing was created.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="New count actions"
        primary={
          <Button
            size="sm"
            color="module"
            className="ml-auto"
            disabled={warehouseId === '' || create.isPending}
            loading={create.isPending}
            onClick={submit}
          >
            <Icon glyph={faClipboardCheck} className="size-4" aria-hidden />
            Start counting
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {locationsQuery.isPending ? (
            <PaneWaiting label="Loading your locations…" />
          ) : locations.length === 0 ? (
            <NowhereToCount ctx={ctx} />
          ) : (
            <section className="card bg-base-100 flex flex-col gap-4 p-4">
              <Text className="text-sm">
                Count what is really on the shelf, then apply it to put your numbers right.
              </Text>

              <Field>
                <FieldLabel>Where are you counting?</FieldLabel>
                <NativeSelect
                  size="sm"
                  value={warehouseId}
                  aria-label="Where are you counting"
                  onChange={(event) => {
                    setWarehouseId(event.target.value);
                  }}
                >
                  <option value="" disabled>
                    Choose a location…
                  </option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  Counts are kept per place, so counting one shop never changes what another has.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>What do you want to count?</FieldLabel>
                <NativeSelect
                  size="sm"
                  value={type}
                  aria-label="What do you want to count"
                  onChange={(event) => {
                    setType(event.target.value as CountType);
                  }}
                >
                  <option value="full">Everything kept at this location</option>
                  <option value="cycle">Just certain items I&apos;ll choose</option>
                </NativeSelect>
                <FieldDescription>
                  {type === 'full'
                    ? 'Anything that already has stock here is listed for you. If nothing does yet, you start empty and add items by scanning or typing a code.'
                    : 'You start with an empty list and add the items you want to count as you go — good for a quick spot-check.'}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>A note (optional)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      size="sm"
                      value={note}
                      placeholder="End-of-month count"
                      onChange={(event) => {
                        setNote(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>Kept with the count, so it makes sense later.</FieldDescription>
              </Field>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function NowhereToCount({ ctx }: { ctx: SurfaceContext }) {
  return (
    <EmptyState
      icon={<Icon glyph={faWarehouse} className="size-6" aria-hidden />}
      title="You have nowhere to count yet"
      description="A count is always tied to one place — a shop, a warehouse, a van. Set up at least one location and you can start counting what is on its shelves."
      actions={
        <Button
          size="sm"
          color="module"
          onClick={() => {
            ctx.open('inventory.warehouses.list', undefined, { target: 'tab' });
          }}
        >
          Set up a location
        </Button>
      }
    />
  );
}
