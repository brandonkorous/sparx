'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, ToggleGroup, ToggleGroupItem } from '@wizeworks/silicaui-react';
import { Check, LayoutGrid, Plus, Rows3 } from 'lucide-react';
import {
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  type ListToolbarView,
} from '@sparx/ui';
import { createLegalPage, addLegalPlacement, acknowledgeLegalPage } from './actions';

export type ChecklistState = 'complete' | 'missing' | 'draft' | 'stale' | 'unplaced';

export interface ChecklistItem {
  legalKind: string;
  title: string;
  defaultSlug: string;
  required: boolean;
  state: ChecklistState;
  entry: {
    id: string;
    slug: string | null;
    status: string;
    updatedAt: string;
    templateVersion: number | null;
    currentVersion: number;
    acknowledged: boolean;
    placed: boolean;
  } | null;
}

export interface ChecklistData {
  items: ChecklistItem[];
  completeness: { requiredTotal: number; requiredComplete: number };
}

const STATE_LABEL: Record<ChecklistState, string> = {
  complete: 'Published',
  missing: 'Not created',
  draft: 'Draft',
  stale: 'Update available',
  unplaced: 'Not in footer',
};

function stateColor(state: ChecklistState): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'complete') return 'success';
  if (state === 'missing') return 'neutral';
  return 'warning';
}

// Policy-pages checklist — a Collection/List surface over a small, fixed set
// of legal document kinds (not paginated, so no ListToolbar/search — just the
// same table/card view toggle every other CMS list uses instead of a bespoke
// stacked-card layout).

export function LegalChecklist({ data }: { data: ChecklistData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ListToolbarView>('table');

  const { requiredComplete, requiredTotal } = data.completeness;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const slugFor = (item: ChecklistItem) => item.entry?.slug ?? item.defaultSlug;

  const stateBadge = (item: ChecklistItem) => (
    <Badge color={stateColor(item.state)} variant="soft">
      {item.state === 'complete' ? <Check className="mr-1 size-3" /> : null}
      {STATE_LABEL[item.state]}
    </Badge>
  );

  const unreviewedBadge = (item: ChecklistItem) =>
    item.entry && !item.entry.acknowledged ? (
      <Badge color="warning" variant="soft" size="sm">
        Unreviewed starter text
      </Badge>
    ) : null;

  const actions = (item: ChecklistItem) => (
    <div className="flex flex-wrap items-center gap-2">
      {item.entry && !item.entry.acknowledged ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => acknowledgeLegalPage(item.entry!.id))}
        >
          <Check className="mr-1 size-3" />
          Mark reviewed
        </Button>
      ) : null}

      {item.state === 'missing' ? (
        <Button
          color="primary"
          variant="soft"
          size="sm"
          disabled={pending}
          onClick={() => run(() => createLegalPage(item.legalKind))}
        >
          <Plus className="mr-1 size-3" />
          Create from template
        </Button>
      ) : item.state === 'unplaced' && item.entry ? (
        <>
          <Button
            color="primary"
            variant="soft"
            size="sm"
            disabled={pending}
            onClick={() => run(() => addLegalPlacement(item.entry!.id))}
          >
            Add to footer
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/cms/${item.entry!.id}`)}>
            Edit
          </Button>
        </>
      ) : item.entry ? (
        <Button variant="outline" size="sm" onClick={() => router.push(`/cms/${item.entry!.id}`)}>
          {item.state === 'draft' ? 'Edit & publish' : 'Edit'}
        </Button>
      ) : null}
    </div>
  );

  const columns: SelectionColumn<ChecklistItem>[] = [
    {
      header: 'Page',
      cell: (item) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.title}</p>
            {item.required ? (
              <Badge color="neutral" variant="soft" size="sm">
                Required
              </Badge>
            ) : null}
            {unreviewedBadge(item)}
          </div>
          <p className="text-base-content/70 text-xs">
            /{slugFor(item)}
            {item.state === 'stale' && item.entry
              ? ` · template v${item.entry.templateVersion ?? '—'} → v${item.entry.currentVersion} available`
              : ''}
          </p>
        </div>
      ),
    },
    { header: 'Status', cell: stateBadge },
    { header: 'Actions', cell: actions },
  ];

  const card: SelectionCard<ChecklistItem> = {
    title: (item) => <p className="truncate font-medium">{item.title}</p>,
    subtitle: (item) => <p className="text-base-content/70 text-xs">/{slugFor(item)}</p>,
    badge: (item) => (
      <div className="flex flex-col items-end gap-1">
        {item.required ? (
          <Badge color="neutral" variant="soft" size="sm">
            Required
          </Badge>
        ) : null}
        {stateBadge(item)}
      </div>
    ),
    body: (item) => (
      <>
        {unreviewedBadge(item)}
        {actions(item)}
      </>
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold">Policy pages</h3>
          <Badge color={requiredComplete >= requiredTotal ? 'success' : 'warning'} variant="soft">
            {requiredComplete}/{requiredTotal} required published
          </Badge>
        </div>
        <ToggleGroup
          aria-label="List view"
          value={[view]}
          onValueChange={(next: string[]) => {
            const v = next[0];
            if (v) setView(v as ListToolbarView);
          }}
        >
          <ToggleGroupItem value="table" aria-label="Table view">
            <Rows3 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="card" aria-label="Card view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <SelectionList
        items={data.items}
        view={view}
        getId={(item) => item.legalKind}
        getRowLabel={(item) => item.title}
        entityLabelPlural="policy pages"
        columns={columns}
        card={card}
      />
    </div>
  );
}
