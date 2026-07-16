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
} from '@wizeworks/silicaui-react';
import {
  SelectionList,
  Tag,
  toast,
  useConfirm,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';
import { CalendarDays, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { SchedulingResource } from '../../_lib/types';
import { RESOURCE_KIND_LABEL } from '../../_lib/format';
import { deleteResourceAction } from '../../_lib/actions';
import { ResourceForm } from './resource-form';
import { CalendarFeedDialog } from './calendar-feed-dialog';

// Resources index list — rendered through the shared `SelectionList` dual-view
// substrate (docs/34 §7) so it gains the Table/Cards toggle. Read-only
// selection: each row's actions (edit / calendar feed / delete) live in a
// dropdown, not a bulk operation.

interface ResourcesListProps {
  resources: SchedulingResource[];
  view: 'table' | 'card';
}

function capacityLabel(r: SchedulingResource): string {
  if (r.kind === 'table' && (r.capacityMin || r.capacityMax)) {
    return `${r.capacityMin ?? 1}–${r.capacityMax ?? r.capacity}`;
  }
  return String(r.capacity);
}

export function ResourcesList({ resources, view }: ResourcesListProps) {
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

  const nameCell = (r: SchedulingResource) => (
    <span className="inline-flex items-center gap-2">
      {r.color ? (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: r.color }}
        />
      ) : null}
      <span className="font-medium">{r.name}</span>
    </span>
  );

  const statusBadge = (r: SchedulingResource) => (
    <Badge color={r.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
      {r.isActive ? 'Active' : 'Inactive'}
    </Badge>
  );

  const skillTags = (r: SchedulingResource) => (
    <span className="flex flex-wrap gap-1">
      {r.skillTags.slice(0, 4).map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
      {r.skillTags.length > 4 ? (
        <span className="text-base-content text-xs">+{r.skillTags.length - 4}</span>
      ) : null}
    </span>
  );

  const actionsMenu = (r: SchedulingResource) => (
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
        <DropdownMenuItem onClick={() => void remove(r)} className="text-danger">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: SelectionColumn<SchedulingResource>[] = [
    { header: 'Name', cell: nameCell },
    { header: 'Type', cell: (r) => RESOURCE_KIND_LABEL[r.kind] },
    { header: 'Capacity', cell: capacityLabel },
    { header: 'Skills', cell: skillTags },
    {
      header: 'Mode',
      cell: (r) => (
        <Badge variant="soft" size="sm" color={r.exclusive ? 'neutral' : 'info'}>
          {r.exclusive ? 'Exclusive' : 'Pooled'}
        </Badge>
      ),
    },
    { header: 'Status', cell: statusBadge },
    { header: '', align: 'right', cell: actionsMenu },
  ];

  const card: SelectionCard<SchedulingResource> = {
    title: nameCell,
    subtitle: (r) => <p className="text-base-content text-xs">{RESOURCE_KIND_LABEL[r.kind]}</p>,
    badge: statusBadge,
    body: (r) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-sm">Capacity {capacityLabel(r)}</p>
          <Badge variant="soft" size="sm" color={r.exclusive ? 'neutral' : 'info'}>
            {r.exclusive ? 'Exclusive' : 'Pooled'}
          </Badge>
        </div>
        {r.skillTags.length > 0 && skillTags(r)}
        <div className="flex justify-end">{actionsMenu(r)}</div>
      </>
    ),
  };

  return (
    <>
      <SelectionList
        items={resources}
        view={view}
        getId={(r) => r.id}
        getRowLabel={(r) => r.name}
        entityLabelPlural="resources"
        selectable={false}
        columns={columns}
        card={card}
      />

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
