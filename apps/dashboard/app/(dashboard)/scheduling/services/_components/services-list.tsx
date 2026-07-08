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
import { toast, useConfirm } from '@sparx/ui';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { SchedulingService } from '../../_lib/types';
import { BOOKING_TYPE_LABEL, duration, money } from '../../_lib/format';
import { deleteServiceAction } from '../../_lib/actions';
import { ServiceForm } from './service-form';

export function ServicesList({ services }: { services: SchedulingService[] }) {
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

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Duration</th>
            <th>Price</th>
            <th>Capacity</th>
            <th>Status</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr key={svc.id}>
              <td className="font-medium">{svc.name}</td>
              <td>{BOOKING_TYPE_LABEL[svc.bookingType]}</td>
              <td>{duration(svc.durationMinutes)}</td>
              <td>{svc.priceCents > 0 ? money(svc.priceCents, svc.currency) : '—'}</td>
              <td>{svc.capacity}</td>
              <td>
                <Badge color={svc.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
                  {svc.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td>
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
                    <DropdownMenuItem
                      onClick={() => void remove(svc)}
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
