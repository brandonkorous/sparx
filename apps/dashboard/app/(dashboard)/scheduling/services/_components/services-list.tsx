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
  toast,
  useConfirm,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { SchedulingService } from '../../_lib/types';
import { BOOKING_TYPE_LABEL, duration, money } from '../../_lib/format';
import { deleteServiceAction } from '../../_lib/actions';
import { ServiceForm } from './service-form';

// Services index list — rendered through the shared `SelectionList` dual-view
// substrate (docs/34 §7) so it gains the Table/Cards toggle. Read-only
// selection: each row's actions (edit / delete) live in a dropdown.

interface ServicesListProps {
  services: SchedulingService[];
  view: 'table' | 'card';
}

export function ServicesList({ services, view }: ServicesListProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<SchedulingService | null>(null);

  async function remove(svc: SchedulingService) {
    const ok = await confirm({
      title: `Delete "${svc.name}"?`,
      description:
        'The service is archived — existing bookings keep their reference, but it can no longer be booked.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteServiceAction(svc.id);
    if (result.ok) {
      toast.success('Service deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const priceLabel = (svc: SchedulingService) =>
    svc.priceCents > 0 ? money(svc.priceCents, svc.currency) : '—';

  const statusBadge = (svc: SchedulingService) => (
    <Badge color={svc.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
      {svc.isActive ? 'Active' : 'Inactive'}
    </Badge>
  );

  const actionsMenu = (svc: SchedulingService) => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" shape="square" size="sm" aria-label="Service actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setEditing(svc)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void remove(svc)} className="text-danger">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: SelectionColumn<SchedulingService>[] = [
    { header: 'Name', cell: (svc) => <span className="font-medium">{svc.name}</span> },
    { header: 'Type', cell: (svc) => BOOKING_TYPE_LABEL[svc.bookingType] },
    { header: 'Duration', cell: (svc) => duration(svc.durationMinutes) },
    { header: 'Price', cell: priceLabel },
    { header: 'Capacity', cell: (svc) => svc.capacity },
    { header: 'Status', cell: statusBadge },
    { header: '', align: 'right', cell: actionsMenu },
  ];

  const card: SelectionCard<SchedulingService> = {
    title: (svc) => <p className="font-medium">{svc.name}</p>,
    subtitle: (svc) => (
      <p className="text-base-content/70 text-xs">
        {BOOKING_TYPE_LABEL[svc.bookingType]} · {duration(svc.durationMinutes)}
      </p>
    ),
    badge: statusBadge,
    body: (svc) => (
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-base-content/70 text-sm">
          {priceLabel(svc)} · capacity {svc.capacity}
        </p>
        {actionsMenu(svc)}
      </div>
    ),
  };

  return (
    <>
      <SelectionList
        items={services}
        view={view}
        getId={(svc) => svc.id}
        getRowLabel={(svc) => svc.name}
        entityLabelPlural="services"
        selectable={false}
        columns={columns}
        card={card}
      />

      {editing ? (
        <ServiceForm
          presentation="modal"
          service={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
    </>
  );
}
