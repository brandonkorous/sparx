'use client';

// PEOPLE & EQUIPMENT: whatever a booking uses up (staff, a room, a bay, a machine).
// Two bookings never claim the same one at once. The PEOPLE are the same records
// as My Team (issue 120): adding somebody in either place adds them in both.

// No free-text search: resources are few and filtered by KIND, so the toolbar has
// a kind picker and an "in use only" toggle, both SERVER filters.

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

interface ToolbarProps {
  kind: string;
  setKind: (next: string) => void;
  activeOnly: boolean;
  setActiveOnly: (next: boolean) => void;
  openNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
  query: ReturnType<typeof useResources>;
}

function ResourcesToolbar(props: ToolbarProps) {
  const { kind, setKind, activeOnly, setActiveOnly, query } = props;
  return (
    <PaneToolbar
      label="People and equipment controls"
      primaryAction={{
        label: 'Add a person or equipment',
        icon: faPlus,
        onClick: props.openNew,
        title: 'Add a person or equipment: hold Shift to open alongside, Alt for a new window',
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
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

export function ResourcesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [kind, setKind] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  const query = useResources({
    ...(kind ? { kind: kind as ResourceKind } : {}),
    activeOnly,
  });

  const rows = query.data?.items ?? [];
  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <ResourcesToolbar
        kind={kind}
        setKind={setKind}
        activeOnly={activeOnly}
        setActiveOnly={setActiveOnly}
        openNew={openNew}
        query={query}
      />

      <ResourcesCard ctx={ctx} query={query} kind={kind} openNew={openNew} />

      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

interface CardProps {
  ctx: SurfaceContext;
  query: ReturnType<typeof useResources>;
  kind: string;
  openNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
}

function ResourcesCard({ ctx, query, kind, openNew }: CardProps) {
  const rows = query.data?.items ?? [];
  return (
    <Card className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto">
      {/* Only where people are actually in view: an equipment-only filter has
          no roster to be the same as. */}
      {rows.some((row) => row.kind === 'staff') ? (
        <RosterNote
          onOpenTeam={() => {
            ctx.open('staff.people', {}, { target: 'tab' });
          }}
        />
      ) : null}
      <ResourcesBody
        isError={query.isError}
        error={query.error}
        isPending={query.isPending}
        rows={rows}
        kind={kind}
        onRetry={() => {
          void query.refetch();
        }}
        onAdd={() => {
          openNew({ shiftKey: false, altKey: false });
        }}
        onOpen={(resource, event) => {
          ctx.open(DETAIL_KEY, { id: resource.id }, { target: targetFor(event) });
        }}
      />
    </Card>
  );
}
