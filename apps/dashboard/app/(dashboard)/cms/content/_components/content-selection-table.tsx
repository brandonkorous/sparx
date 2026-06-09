'use client';

import * as React from 'react';
import { Archive, Trash2, Zap } from 'lucide-react';
import {
  Badge,
  BulkActionBar,
  type BulkAction,
  Card,
  CardContent,
  Checkbox,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import {
  bulkPublishEntriesAction,
  bulkArchiveEntriesAction,
  bulkDeleteEntriesAction,
} from '../../content-bulk-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface ApiEntry {
  id: string;
  type_key: string;
  slug: string | null;
  status: string;
  body: { title?: string; name?: string } & Record<string, unknown>;
  updated_at: string;
  published_at: string | null;
}

interface ContentSelectionTableProps {
  entries: ApiEntry[];
  view: 'table' | 'card';
  showType: boolean;
  typeName: Record<string, string>;
}

function entryTitle(e: ApiEntry): string {
  if (typeof e.body.title === 'string' && e.body.title) return e.body.title;
  if (typeof e.body.name === 'string' && e.body.name) return e.body.name;
  return e.slug ?? '(untitled)';
}

function entryHref(e: ApiEntry): string {
  return e.type_key === 'page' ? `/cms/${e.id}` : `/cms/types/${e.type_key}/${e.id}`;
}

function rowEntityType(e: ApiEntry): string {
  return e.type_key === 'page' ? 'page' : 'content-entry';
}

function rowEntityId(e: ApiEntry): string {
  return e.type_key === 'page' ? e.id : `${e.type_key}:${e.id}`;
}

export function ContentSelectionTable({
  entries,
  view,
  showType,
  typeName,
}: ContentSelectionTableProps) {
  const [selected, setSelected] = React.useState<string[]>([]);

  const allIds = entries.map((e) => e.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : allIds);
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'Publish',
      icon: Zap,
      onAction: async (ids) => {
        await bulkPublishEntriesAction(ids);
        setSelected([]);
      },
    },
    {
      label: 'Archive',
      icon: Archive,
      onAction: async (ids) => {
        await bulkArchiveEntriesAction(ids);
        setSelected([]);
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} entr{count === 1 ? "y" : "ies"}? Revisions and media references are also removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteEntriesAction(ids);
        setSelected([]);
      },
    },
  ];

  if (view === 'card') {
    return (
      <>
        <Grid minItemWidth="18rem" gap={4}>
          {entries.map((e) => (
            <Card key={e.id} variant="module" padding="md">
              <Stack gap={3}>
                <Stack direction="row" align="start" justify="between" gap={2}>
                  <Stack direction="row" align="start" gap={2} className="min-w-0">
                    <Checkbox
                      checked={selected.includes(e.id)}
                      onCheckedChange={() => toggle(e.id)}
                      aria-label={`Select ${entryTitle(e)}`}
                      className="mt-0.5 shrink-0"
                    />
                    <Stack gap={1} className="min-w-0">
                      <EntityRowLink
                        href={entryHref(e)}
                        entityType={rowEntityType(e)}
                        entityId={rowEntityId(e)}
                        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {entryTitle(e)}
                      </EntityRowLink>
                      {e.slug && (
                        <Text size="xs" variant="muted">
                          /{e.slug}
                        </Text>
                      )}
                    </Stack>
                  </Stack>
                  <Badge
                    color={e.status === 'published' ? 'success' : 'outline'}
                    className="text-xs"
                  >
                    {e.status}
                  </Badge>
                </Stack>
                <Stack direction="row" align="center" justify="between" gap={2}>
                  {showType && (
                    <Badge color="module" variant="soft" className="text-xs">
                      {typeName[e.type_key] ?? e.type_key}
                    </Badge>
                  )}
                  <Text size="xs" variant="muted">
                    {e.status === 'published' && e.published_at
                      ? `Published ${new Date(e.published_at).toLocaleDateString()}`
                      : `Updated ${new Date(e.updated_at).toLocaleDateString()}`}
                  </Text>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Grid>

        <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
      </>
    );
  }

  return (
    <>
      <Card variant="module" padding="none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all entries"
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                {showType && <TableHead>Type</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow
                  key={e.id}
                  data-state={selected.includes(e.id) ? 'selected' : undefined}
                  className="group"
                >
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected.includes(e.id)}
                      onCheckedChange={() => toggle(e.id)}
                      aria-label={`Select ${entryTitle(e)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack gap={1}>
                      <EntityRowLink
                        href={entryHref(e)}
                        entityType={rowEntityType(e)}
                        entityId={rowEntityId(e)}
                        className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {entryTitle(e)}
                      </EntityRowLink>
                      {e.slug && (
                        <Text size="xs" variant="muted">
                          /{e.slug}
                        </Text>
                      )}
                    </Stack>
                  </TableCell>
                  {showType && (
                    <TableCell>
                      <Badge color="module" variant="soft" className="text-xs">
                        {typeName[e.type_key] ?? e.type_key}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      color={e.status === 'published' ? 'success' : 'outline'}
                      className="text-xs"
                    >
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {new Date(e.updated_at).toLocaleDateString()}
                    </Text>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
    </>
  );
}
