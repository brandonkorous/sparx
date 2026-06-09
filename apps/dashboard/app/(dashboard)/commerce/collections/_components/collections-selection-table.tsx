'use client';

import * as React from 'react';
import { Sparkles, Star, Trash2 } from 'lucide-react';
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

import { bulkDeleteCollectionsAction } from '../../collection-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface CollectionSummary {
  id: string;
  name: string;
  handle: string;
  type: 'manual' | 'rules';
  productCount: number;
  featured: boolean;
  updatedAt: string;
}

interface CollectionsSelectionTableProps {
  collections: CollectionSummary[];
  view: 'table' | 'card';
}

export function CollectionsSelectionTable({ collections, view }: CollectionsSelectionTableProps) {
  const [selected, setSelected] = React.useState<string[]>([]);

  const allIds = collections.map((c) => c.id);
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
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} collection{count === 1 ? "" : "s"}? Products are unlinked but not removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteCollectionsAction(ids);
        setSelected([]);
      },
    },
  ];

  if (view === 'card') {
    return (
      <>
        <Grid minItemWidth="18rem" gap={4}>
          {collections.map((c) => (
            <Card key={c.id} variant="module" padding="md">
              <Stack gap={3}>
                <Stack direction="row" align="start" justify="between" gap={2}>
                  <Stack direction="row" align="start" gap={2} className="min-w-0">
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      aria-label={`Select ${c.name}`}
                      className="mt-0.5 shrink-0"
                    />
                    <Stack gap={1} className="min-w-0">
                      <EntityRowLink
                        href={`/commerce/collections/${c.id}`}
                        entityType="collection"
                        entityId={c.id}
                        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {c.name}
                      </EntityRowLink>
                      <Text size="xs" variant="muted">
                        /{c.handle}
                      </Text>
                    </Stack>
                  </Stack>
                  <Badge color={c.type === 'rules' ? 'module' : 'outline'} className="text-xs">
                    {c.type === 'rules' ? (
                      <>
                        <Sparkles className="mr-1 h-3 w-3" />
                        rules
                      </>
                    ) : (
                      'manual'
                    )}
                  </Badge>
                </Stack>
                <Stack direction="row" align="center" justify="between" gap={2}>
                  {c.featured ? (
                    <Badge variant="outline" className="text-xs">
                      <Star className="mr-1 h-3 w-3" />
                      featured
                    </Badge>
                  ) : (
                    <span />
                  )}
                  <Text size="sm" className="tabular-nums">
                    {c.productCount} product{c.productCount === 1 ? '' : 's'}
                  </Text>
                </Stack>
                <Text size="xs" variant="muted">
                  updated {new Date(c.updatedAt).toLocaleDateString()}
                </Text>
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
      <Card padding="none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all collections"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((c) => (
                <TableRow
                  key={c.id}
                  data-state={selected.includes(c.id) ? 'selected' : undefined}
                  className="group"
                >
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      aria-label={`Select ${c.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack gap={1}>
                      <Stack direction="row" align="center" gap={2}>
                        <EntityRowLink
                          href={`/commerce/collections/${c.id}`}
                          entityType="collection"
                          entityId={c.id}
                          className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                        >
                          {c.name}
                        </EntityRowLink>
                        {c.featured && (
                          <Badge variant="outline" className="text-xs">
                            <Star className="mr-1 h-3 w-3" />
                            featured
                          </Badge>
                        )}
                      </Stack>
                      <Text size="xs" variant="muted">
                        /{c.handle}
                      </Text>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Badge color={c.type === 'rules' ? 'module' : 'outline'} className="text-xs">
                      {c.type === 'rules' ? (
                        <>
                          <Sparkles className="mr-1 h-3 w-3" />
                          rules
                        </>
                      ) : (
                        'manual'
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Text size="sm">{c.productCount}</Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {new Date(c.updatedAt).toLocaleDateString()}
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
