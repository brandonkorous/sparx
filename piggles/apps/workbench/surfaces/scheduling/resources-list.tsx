'use client';

// PEOPLE & EQUIPMENT — whatever a booking uses up: a member of staff, a room, a
// bay, a machine. Two bookings can never claim the same one at the same time.
//
// The PEOPLE here are the same people as My Team — one roster, one record,
// two faces (issue 120). Adding somebody in either place adds them in both.
//
// A table, like every other list. The list endpoint has no free-text search —
// resources are few, and you filter by KIND, not by typing — so the toolbar
// carries a kind picker and an "in use only" toggle, both SERVER filters, and no
// search box it cannot honour.

import { useState } from 'react';

import { Card, NativeSelect, ToggleGroup, ToggleGroupItem } from '@wizeworks/silicaui-react';
import { faEyeSlash, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { RESOURCE_KINDS, useResources, type ResourceKind } from './setup-data';
import { ResourcesBody, RosterNote } from './resources-body';

const DETAIL_KEY = 'scheduling.resources.detail';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function KindFilter({ kind, setKind }: { kind: string; setKind: (next: string) => void }) {
  return (
    <NativeSelect
      size="sm"
      className="max-w-52 shrink"
      aria-label="Show only one kind"
      value={kind}
      onChange={(event) => {
        setKind(event.target.value);
      }}
    >
      <option value="">Every kind</option>
      {RESOURCE_KINDS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function InUseOnlyToggle({
  activeOnly,
  setActiveOnly,
}: {
  activeOnly: boolean;
  setActiveOnly: (next: boolean) => void;
}) {
  return (
    <ToggleGroup
      size="sm"
      color="module"
      className="shrink-0"
      value={activeOnly ? ['active'] : []}
      onValueChange={(next: unknown[]) => {
        setActiveOnly(next.includes('active'));
      }}
    >
      <ToggleGroupItem
        value="active"
        aria-label="Hide switched-off ones"
        title="Hide switched-off ones"
      >
        <Icon glyph={faEyeSlash} className="size-4" aria-hidden />
        <span>In use only</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function ResourcesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [kind, setKind] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const { data, isPending, isFetching, dataUpdatedAt, isError, refetch } = useResources({
    ...(kind ? { kind: kind as ResourceKind } : {}),
    activeOnly,
  });

  const rows = data?.items ?? [];
  const reload = () => {
    void refetch();
  };

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="People & equipment list controls"
        primaryAction={{
          label: 'Add one',
          icon: faPlus,
          onClick: openNew,
          title: 'Add one — hold Shift to open alongside, Alt for a new window',
        }}
        controls={
          <>
            <KindFilter kind={kind} setKind={setKind} />
            <InUseOnlyToggle activeOnly={activeOnly} setActiveOnly={setActiveOnly} />
          </>
        }
        views={{
          // The surface's REGISTRY KEY as a path, not its URL.
          target: '/scheduling/resources',
          params: { kind, active: activeOnly ? '1' : '' },
          onApply: (next) => {
            setKind(next.kind ?? '');
            setActiveOnly(next.active === '1');
          },
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={reload}
          />
        }
      />

      <Card className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto">
        {/* Only where people are actually in view — an equipment-only filter has
            no roster to be the same as. */}
        {rows.some((row) => row.kind === 'staff') ? (
          <RosterNote
            onOpenTeam={() => {
              ctx.open('staff.people', {}, { target: 'tab' });
            }}
          />
        ) : null}
        <ResourcesBody
          isError={isError}
          isPending={isPending}
          rows={rows}
          kind={kind}
          onRetry={reload}
          onAdd={() => {
            openNew({ shiftKey: false, altKey: false });
          }}
          onOpen={(resource, event) => {
            ctx.open(DETAIL_KEY, { id: resource.id }, { target: targetFor(event) });
          }}
        />
      </Card>

      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
