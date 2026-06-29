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
  Badge,
  Button,
  Card,
  EmptyState,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';
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
      leftIcon={<Trash2 className="h-3 w-3" />}
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
      cell: (r) => (
        <Text size="sm" className="truncate font-mono">
          {r.from_path}
        </Text>
      ),
    },
    {
      header: 'To',
      cell: (r) => (
        <Stack direction="row" align="center" gap={2} className="min-w-0">
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          <Text size="sm" className="truncate font-mono">
            {r.to_path}
          </Text>
        </Stack>
      ),
    },
    {
      header: 'Hits',
      align: 'right',
      cell: (r) => (
        <Text size="sm" variant="muted">
          {r.hit_count}
        </Text>
      ),
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
      <Stack direction="row" align="center" gap={2} className="min-w-0">
        <Badge color="neutral" variant="soft" size="sm">
          {r.status_code}
        </Badge>
        <Text size="sm" className="truncate font-mono">
          {r.from_path}
        </Text>
      </Stack>
    ),
    body: (r) => (
      <Stack gap={2}>
        <Stack direction="row" align="center" gap={2} className="min-w-0">
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          <Text size="sm" className="truncate font-mono">
            {r.to_path}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            {r.hit_count} hits
          </Text>
          {removeButton(r)}
        </Stack>
      </Stack>
    ),
  };

  return (
    <Stack gap={5}>
      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite">
          {error}
        </Text>
      )}

      <Text size="sm" variant="muted">
        {rows.length} redirect{rows.length === 1 ? '' : 's'} active.
      </Text>

      {rows.length === 0 ? (
        <Card variant="module" padding="none">
          <EmptyState
            icon={<Waypoints className="h-5 w-5" />}
            title="No redirects yet"
            description="Add a redirect to forward an old URL to a new one. Redirects are returned with the chosen HTTP status code on every storefront hit."
            action={
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
    </Stack>
  );
}
