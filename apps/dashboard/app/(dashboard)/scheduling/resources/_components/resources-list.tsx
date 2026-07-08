'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
} from 'silicaui-react';
import { Tag, toast, useConfirm } from '@sparx/ui';
import { CalendarDays, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { SchedulingResource } from '../../_lib/types';
import { RESOURCE_KIND_LABEL } from '../../_lib/format';
import { deleteResourceAction } from '../../_lib/actions';
import { ResourceForm } from './resource-form';
import { CalendarFeedDialog } from './calendar-feed-dialog';

export function ResourcesList({ resources }: { resources: SchedulingResource[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<SchedulingResource | null>(null);
  const [feedFor, setFeedFor] = useState<SchedulingResource | null>(null);

  async function remove(r: SchedulingResource) {
    const ok = await confirm({
      title: `Delete "${r.name}"?`,
      description: 'The resource is archived; existing bookings keep their reference.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteResourceAction(r.id);
    if (result.ok) {
      toast.success('Resource deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Capacity</th>
            <th>Skills</th>
            <th>Mode</th>
            <th>Status</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">
                <span className="inline-flex items-center gap-2">
                  {r.color ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                  ) : null}
                  {r.name}
                </span>
              </td>
              <td>{RESOURCE_KIND_LABEL[r.kind]}</td>
              <td>
                {r.kind === 'table' && (r.capacityMin || r.capacityMax)
                  ? `${r.capacityMin ?? 1}–${r.capacityMax ?? r.capacity}`
                  : r.capacity}
              </td>
              <td>
                <span className="flex flex-wrap gap-1">
                  {r.skillTags.slice(0, 4).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                  {r.skillTags.length > 4 ? (
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      +{r.skillTags.length - 4}
                    </span>
                  ) : null}
                </span>
              </td>
              <td>
                <Badge variant="soft" size="sm" color={r.exclusive ? 'neutral' : 'info'}>
                  {r.exclusive ? 'Exclusive' : 'Pooled'}
                </Badge>
              </td>
              <td>
                <Badge color={r.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
                  {r.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="ghost" shape="square" size="sm" aria-label="Resource actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(r)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFeedFor(r)}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Calendar feed
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void remove(r)}
                      className="text-[var(--color-danger)]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {editing ? (
        <ResourceForm
          presentation="modal"
          resource={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}

      <CalendarFeedDialog
        resourceId={feedFor?.id ?? ''}
        resourceName={feedFor?.name ?? ''}
        open={feedFor !== null}
        onOpenChange={(o) => !o && setFeedFor(null)}
      />
    </>
  );
}
