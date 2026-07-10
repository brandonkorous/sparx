'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
} from '@sparx/ui';
import { Badge, Button, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ArrowRight, Plus, Trash2, Waypoints } from 'lucide-react';
import { deleteRedirect } from './actions';
import { EntityCreateButton } from '../../_components/entity-create-button';

// Redirects — a standard Collection/List surface (docs/34 §7). Creating a
// redirect (surface-aware form) and CSV bulk import now live in the page
// header (`EntityCreateButton` + `ImportRedirectsButton`); this client
// component owns just the existing-rows rendering through the shared
// SelectionList dual-view substrate, the per-row Remove (delete) action, the
// delete confirmation, and the empty state. The server page computes `view`
// and hands it down with the rows.

interface RedirectRow {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  hit_count: number;
  created_at: string;
}

interface RedirectsListProps {
  rows: RedirectRow[];
  view: 'table' | 'card';
}

export function RedirectsList({ rows, view }: RedirectsListProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<RedirectRow | null>(null);

  function confirmDelete(row: RedirectRow) {
    setPendingDelete(row);
  }

  function executeDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setError(null);
    startTransition(async () => {
      const result = await deleteRedirect(target.id);
      if (!result.ok) {
        setError(result.error ?? 'Could not delete redirect.');
        return;
      }
      router.refresh();
    });
  }

  const removeButton = (r: RedirectRow) => (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      iconStart={<Trash2 className="h-3 w-3" />}
      onClick={() => confirmDelete(r)}
      disabled={pending}
    >
      Remove
    </Button>
  );

  const columns: SelectionColumn<RedirectRow>[] = [
    {
      header: 'Status',
      cell: (r) => (
        <Badge color="neutral" variant="soft" size="sm">
          {r.status_code}
        </Badge>
      ),
    },
    {
      header: 'From',
      cell: (r) => <p className="truncate font-mono text-sm">{r.from_path}</p>,
    },
    {
      header: 'To',
      cell: (r) => (
        <div className="flex min-w-0 flex-row items-center gap-2">
          <ArrowRight className="text-base-content/50 h-4 w-4 shrink-0" />
          <p className="truncate font-mono text-sm">{r.to_path}</p>
        </div>
      ),
    },
    {
      header: 'Hits',
      align: 'right',
      cell: (r) => <p className="text-base-content/70 text-sm">{r.hit_count}</p>,
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (r) => <div className="flex justify-end">{removeButton(r)}</div>,
    },
  ];

  const card: SelectionCard<RedirectRow> = {
    title: (r) => (
      <div className="flex min-w-0 flex-row items-center gap-2">
        <Badge color="neutral" variant="soft" size="sm">
          {r.status_code}
        </Badge>
        <p className="truncate font-mono text-sm">{r.from_path}</p>
      </div>
    ),
    body: (r) => (
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 flex-row items-center gap-2">
          <ArrowRight className="text-base-content/50 h-4 w-4 shrink-0" />
          <p className="truncate font-mono text-sm">{r.to_path}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">{r.hit_count} hits</p>
          {removeButton(r)}
        </div>
      </div>
    ),
  };

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p className="text-danger text-sm" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <p className="text-base-content/70 text-sm">
        {rows.length} redirect{rows.length === 1 ? '' : 's'} active.
      </p>

      {rows.length === 0 ? (
        <Card className="bg-base-100">
          <EmptyState
            icon={<Waypoints className="h-5 w-5" />}
            title="No redirects yet"
            description="Add a redirect to forward an old URL to a new one. Redirects are returned with the chosen HTTP status code on every storefront hit."
            actions={
              <EntityCreateButton
                entityType="redirect"
                newHref="/cms/redirects/new"
                color="module"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add your first redirect
              </EntityCreateButton>
            }
          />
        </Card>
      ) : (
        <SelectionList
          items={rows}
          view={view}
          getId={(r) => r.id}
          getRowLabel={(r) => r.from_path}
          entityLabelPlural="redirects"
          selectable={false}
          columns={columns}
          card={card}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove redirect?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{pendingDelete?.from_path}</span> will no longer forward
              to <span className="font-mono">{pendingDelete?.to_path}</span>. Any external links to
              the old path will return 404.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete}>Remove redirect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
